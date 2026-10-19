"""Mampostería confinada — NTC para Diseño y Construcción de Estructuras de Mampostería (referencia que
los reglamentos de B.C. remiten). Método simplificado para casas y edificios bajos regulares.

v*m (resistencia de diseño a compresión diagonal) debe salir de pruebas o de la tabla de la NTC vigente
para la pieza y mortero reales; los valores por omisión son SUPUESTOS A VALIDAR.
Unidades: kg, cm, kg/cm².
"""
from dataclasses import dataclass, field

FR_CORTANTE = 0.7

VM_TIPICOS = {  # kg/cm², referencia preliminar — verificar con NTC vigente o pruebas
    "block_concreto_hueco_mortero_I": 3.5,
    "tabique_rojo_recocido_mortero_I": 3.5,
    "tabique_extruido_hueco_mortero_I": 3.0,
}

@dataclass
class Muro:
    eje: str
    direccion: str      # "X" o "Y"
    L: float            # longitud cm
    t: float            # espesor cm
    H: float            # altura libre cm
    P: float = 0.0      # carga vertical de servicio sobre el muro (kg) para la contribución 0.3P

    @property
    def AT(self):
        return self.L * self.t

    @property
    def FAE(self):
        """Factor de área efectiva del método simplificado: 1 si H/L ≤ 1.33; (1.33·L/H)² si no."""
        r = self.H / self.L
        return 1.0 if r <= 1.33 else (1.33 * self.L / self.H) ** 2

def VmR(muro, vm, incluir_carga=True):
    """VmR = FR(0.5·v*m·AT + 0.3P) ≤ 1.5·FR·v*m·AT."""
    v = FR_CORTANTE * (0.5 * vm * muro.AT + (0.3 * muro.P if incluir_carga else 0))
    return min(v, 1.5 * FR_CORTANTE * vm * muro.AT)

@dataclass
class ResultadoSimplificado:
    direccion: str
    Vu: float
    VR: float
    area_efectiva: float
    cumple: bool
    muros: list = field(default_factory=list)

def metodo_simplificado(muros, W_total, cs, vm, FC=1.1):
    """Revisión global por dirección: ΣFAE·VmR ≥ FC·cs·W. cs = coeficiente sísmico reducido del método
    simplificado (o c/Q'R del espectro). W en kg."""
    res = []
    Vu = FC * cs * W_total
    for dirc in ("X", "Y"):
        ms = [m for m in muros if m.direccion == dirc]
        VR = sum(m.FAE * VmR(m, vm) for m in ms)
        Aef = sum(m.FAE * m.AT for m in ms)
        res.append(ResultadoSimplificado(dirc, Vu, VR, Aef, VR >= Vu,
                                         [(m.eje, m.L, m.FAE, VmR(m, vm)) for m in ms]))
    return res

def revisar_confinamiento(muros):
    """Requisitos geométricos de confinamiento (NTC Mampostería): castillos en extremos e intersecciones,
    separación ≤ min(1.5H, 4 m); dalas a cada ≤ 3 m de altura y en todo extremo horizontal."""
    obs = []
    for m in muros:
        s_max = min(1.5 * m.H, 400)
        n_cast = max(2, int(-(-m.L // s_max)) + 1)
        obs.append((m.eje, m.L, s_max, n_cast,
                    f"Mínimo {n_cast} castillos a ≤ {s_max:.0f} cm; dala en remate y a cada ≤ 300 cm de altura"))
    return obs

def castillo_minimo(t=15.0, fy=4200.0, fc=150.0):
    """Refuerzo longitudinal mínimo de castillos y dalas: As ≥ 0.2·f'c/fy·t² (NTC), y al menos 3 barras."""
    As = 0.2 * fc / fy * t ** 2
    return {"As_min": As, "sugerido": "4 vars #3 con estribos #2 @ 20 cm (verificar As_min y separación ≤ 1.5t, 20 cm)"}
