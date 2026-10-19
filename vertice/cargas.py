"""Cargas y combinaciones.

Cargas vivas unitarias: NTC Criterios y Acciones para el Diseño Estructural (tabla de cargas vivas),
referencia que los reglamentos de B.C. adoptan o remiten; verificar la tabla vigente del municipio.
Unidades kg/m².
"""
from dataclasses import dataclass, field

# destino: (Wm máxima gravitacional, Wa instantánea sismo, W media para asentamientos/flechas)
CARGAS_VIVAS = {
    "habitacion": (190, 100, 80),
    "oficinas": (250, 180, 100),
    "comercio": (350, 250, 180),
    "pasillos_escaleras": (350, 150, 40),
    "lugares_reunion_con_asientos": (350, 250, 40),
    "lugares_reunion_sin_asientos": (450, 350, 40),
    "azotea_pendiente_hasta_5pct": (100, 70, 15),
    "azotea_pendiente_mayor_5pct": (40, 20, 5),
    "estacionamiento": (250, 100, 40),
    "bodegas_ligeras": (450, 315, 315),  # orientativo; NTC indica 0.9/0.7 Wm
}

# Carga adicional por concreto colado en sitio y por firme (NTC): +20 kg/m² cada una
ADICIONAL_NTC = 20

@dataclass
class Capa:
    nombre: str
    espesor_m: float = 0.0
    peso_vol: float = 0.0   # kg/m³
    carga_directa: float = 0.0  # kg/m² (plafón, instalaciones, muros divisorios repartidos)

    @property
    def w(self):
        return self.espesor_m * self.peso_vol + self.carga_directa

@dataclass
class SistemaPiso:
    nombre: str
    capas: list = field(default_factory=list)
    colado_en_sitio: bool = True
    con_firme: bool = True

    @property
    def carga_muerta(self):
        cm = sum(c.w for c in self.capas)
        cm += ADICIONAL_NTC * (int(self.colado_en_sitio) + int(self.con_firme))
        return cm

    def desglose(self):
        filas = [(c.nombre, c.espesor_m, c.peso_vol, round(c.w, 1)) for c in self.capas]
        if self.colado_en_sitio:
            filas.append(("Adicional NTC por colado en sitio", "", "", ADICIONAL_NTC))
        if self.con_firme:
            filas.append(("Adicional NTC por firme", "", "", ADICIONAL_NTC))
        return filas

def entrepiso_tipico(espesor_losa=0.12, piso="ceramico"):
    capas = [Capa("Losa maciza de concreto", espesor_losa, 2400),
             Capa("Firme de mortero", 0.03, 2100),
             Capa("Piso cerámico con adhesivo", 0.0, 0, 30 if piso == "ceramico" else 50),
             Capa("Plafón de yeso o tablaroca", 0.0, 0, 20),
             Capa("Instalaciones colgadas", 0.0, 0, 10),
             Capa("Muros divisorios ligeros (repartidos)", 0.0, 0, 50)]
    return SistemaPiso("Entrepiso", capas)

def azotea_tipica(espesor_losa=0.12):
    capas = [Capa("Losa maciza de concreto", espesor_losa, 2400),
             Capa("Relleno para pendiente (tezontle/ligero, prom. 10 cm)", 0.10, 1300),
             Capa("Entortado de mortero", 0.03, 2100),
             Capa("Impermeabilizante", 0.0, 0, 10),
             Capa("Plafón de yeso o tablaroca", 0.0, 0, 20),
             Capa("Instalaciones colgadas", 0.0, 0, 10)]
    return SistemaPiso("Azotea", capas)

# ----- combinaciones -----
def combinaciones_ntc(cm, cv_max, cv_inst, sismo=0.0, viento=0.0, grupo="B"):
    """NTC Criterios y Acciones: FC=1.3CM+1.5CV (grupo B; 1.5/1.7 si grupo A),
    accidental 1.1(CM+CVa+S) y 1.1(CM+CVa+V)."""
    combos = {"1.3CM+1.5CV": 1.3 * cm + 1.5 * cv_max}
    if grupo.upper() == "A":
        combos["1.5CM+1.7CV (grupo A)"] = 1.5 * cm + 1.7 * cv_max
    if sismo:
        combos["1.1(CM+CVa+S)"] = 1.1 * (cm + cv_inst + sismo)
    if viento:
        combos["1.1(CM+CVa+V)"] = 1.1 * (cm + cv_inst + viento)
    combos["envolvente"] = max(combos.values())
    return combos

def combinaciones_aci(D, L, E=0.0, W=0.0, Lr=0.0):
    """ACI 318-19 / ASCE 7 (5.3.1): combinaciones básicas por resistencia."""
    c = {"1.4D": 1.4 * D,
         "1.2D+1.6L+0.5Lr": 1.2 * D + 1.6 * L + 0.5 * Lr,
         "1.2D+1.6Lr+L": 1.2 * D + 1.6 * Lr + L}
    if W:
        c["1.2D+1.0W+L"] = 1.2 * D + W + L
        c["0.9D+1.0W"] = 0.9 * D + W
    if E:
        c["1.2D+1.0E+L"] = 1.2 * D + E + L
        c["0.9D+1.0E"] = 0.9 * D + E
    c["envolvente"] = max(c.values())
    return c

def area_tributaria_losa_perimetral(lado_corto, lado_largo):
    """Áreas tributarias por método de los sobres (45°) de un tablero apoyado en 4 lados.
    Regresa (área para cada viga corta [triángulo], área para cada viga larga [trapecio]) en m²."""
    a, b = lado_corto, lado_largo
    tri = a * a / 4
    trap = (b + (b - a)) * (a / 2) / 2
    return tri, trap
