"""Planos en DXF (AutoCAD R12, sin dependencias) y PDF (matplotlib) con el mismo contenido.

Convención: el dibujo se arma en milímetros de papel sobre una hoja (por omisión 900 × 600 mm).
Cada detalle se coloca con su propia escala (p. ej. 1:20) mediante `Vista`, que convierte cm reales a mm de papel,
y lleva su escala rotulada. Así el DXF se imprime 1:1 y cada detalle conserva su escala.
Capas por omisión (nombre, color ACI): ver CAPAS.
"""
from dataclasses import dataclass, field
from math import cos, sin, radians, pi
from datetime import date
from . import LEYENDA
from .materiales import VARILLAS

CAPAS = {
    "MARCO": 7, "CUADRO": 7, "TEXTO": 7, "COTAS": 3, "EJES": 1, "CONCRETO": 7, "ACERO": 1, "ESTRIBOS": 6,
    "MUROS": 7, "OCULTO": 8, "NOTAS": 7, "SUELO": 8, "INSTALACION": 5,
}
COLOR_PDF = {1: "#c0392b", 3: "#2e7d4f", 5: "#1f5f8b", 6: "#8e44ad", 7: "#1d2328", 8: "#8a939b"}

@dataclass
class Ent:
    tipo: str
    capa: str
    datos: dict

class Dibujo:
    def __init__(self, ancho=900, alto=600):
        self.ancho, self.alto = ancho, alto
        self.ents = []

    # primitivas (mm de papel)
    def linea(self, p1, p2, capa="CONCRETO", tipo="CONTINUOUS"):
        self.ents.append(Ent("LINE", capa, {"p1": p1, "p2": p2, "lt": tipo}))

    def polilinea(self, pts, capa="CONCRETO", cerrada=False, tipo="CONTINUOUS"):
        pts = list(pts)
        for a, b in zip(pts, pts[1:] + ([pts[0]] if cerrada else [])):
            self.linea(a, b, capa, tipo)

    def rect(self, x, y, w, h, capa="CONCRETO"):
        self.polilinea([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], capa, cerrada=True)

    def circulo(self, c, r, capa="CONCRETO", relleno=False):
        self.ents.append(Ent("CIRCLE", capa, {"c": c, "r": r, "relleno": relleno}))

    def arco(self, c, r, a0, a1, capa="CONCRETO"):
        self.ents.append(Ent("ARC", capa, {"c": c, "r": r, "a0": a0, "a1": a1}))

    def texto(self, p, s, h=2.5, capa="TEXTO", alin="izq", rot=0):
        self.ents.append(Ent("TEXT", capa, {"p": p, "s": str(s), "h": h, "alin": alin, "rot": rot}))

    def cota(self, p1, p2, texto, off=6, capa="COTAS", h=2.0):
        """Cota alineada horizontal o vertical con marcas a 45°."""
        (x1, y1), (x2, y2) = p1, p2
        if abs(y1 - y2) < 1e-6:  # horizontal
            y = y1 + off
            self.linea((x1, y1), (x1, y + 1.5 * (1 if off > 0 else -1)), capa)
            self.linea((x2, y2), (x2, y + 1.5 * (1 if off > 0 else -1)), capa)
            self.linea((x1, y), (x2, y), capa)
            for x in (x1, x2): self.linea((x - 1, y - 1), (x + 1, y + 1), capa)
            self.texto(((x1 + x2) / 2, y + 1), texto, h, capa, "centro")
        else:
            x = x1 + off
            self.linea((x1, y1), (x + 1.5 * (1 if off > 0 else -1), y1), capa)
            self.linea((x2, y2), (x + 1.5 * (1 if off > 0 else -1), y2), capa)
            self.linea((x, y1), (x, y2), capa)
            for y in (y1, y2): self.linea((x - 1, y - 1), (x + 1, y + 1), capa)
            self.texto((x - 1 if off < 0 else x + 1, (y1 + y2) / 2), texto, h, capa, "centro", 90)

    # ---------- salida DXF R12 ----------
    def _dxf(self):
        o = []
        A = o.append
        def g(code, val): A(f"{code}\n{val}\n")
        g(0, "SECTION"); g(2, "HEADER")
        g(9, "$ACADVER"); g(1, "AC1009"); g(9, "$INSUNITS"); g(70, 4)
        g(9, "$EXTMIN"); g(10, 0); g(20, 0); g(9, "$EXTMAX"); g(10, self.ancho); g(20, self.alto)
        g(0, "ENDSEC")
        g(0, "SECTION"); g(2, "TABLES")
        g(0, "TABLE"); g(2, "LTYPE"); g(70, 2)
        g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Solid line"); g(72, 65); g(73, 0); g(40, 0.0)
        g(0, "LTYPE"); g(2, "DASHED"); g(70, 0); g(3, "__ __ __"); g(72, 65); g(73, 2); g(40, 9.0); g(49, 6.0); g(49, -3.0)
        g(0, "ENDTAB")
        g(0, "TABLE"); g(2, "LAYER"); g(70, len(CAPAS) + 1)
        g(0, "LAYER"); g(2, "0"); g(70, 0); g(62, 7); g(6, "CONTINUOUS")
        for n, c in CAPAS.items():
            g(0, "LAYER"); g(2, n); g(70, 0); g(62, c); g(6, "DASHED" if n == "OCULTO" else "CONTINUOUS")
        g(0, "ENDTAB")
        g(0, "TABLE"); g(2, "STYLE"); g(70, 1)
        g(0, "STYLE"); g(2, "STANDARD"); g(70, 0); g(40, 0.0); g(41, 1.0); g(50, 0.0); g(71, 0); g(42, 2.5); g(3, "txt"); g(4, "")
        g(0, "ENDTAB")
        g(0, "ENDSEC")
        g(0, "SECTION"); g(2, "ENTITIES")
        for e in self.ents:
            d = e.datos
            if e.tipo == "LINE":
                g(0, "LINE"); g(8, e.capa)
                if d["lt"] != "CONTINUOUS": g(6, d["lt"])
                g(10, f'{d["p1"][0]:.4f}'); g(20, f'{d["p1"][1]:.4f}'); g(30, 0)
                g(11, f'{d["p2"][0]:.4f}'); g(21, f'{d["p2"][1]:.4f}'); g(31, 0)
            elif e.tipo == "CIRCLE":
                if d["relleno"]:
                    # dona rellena: polilínea de dos vértices con abombamiento 1 y ancho = radio
                    r = d["r"]; cx, cy = d["c"]
                    g(0, "POLYLINE"); g(8, e.capa); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1); g(40, r); g(41, r)
                    for (x, y) in ((cx - r / 2, cy), (cx + r / 2, cy)):
                        g(0, "VERTEX"); g(8, e.capa); g(10, f"{x:.4f}"); g(20, f"{y:.4f}"); g(30, 0); g(42, 1.0)
                    g(0, "SEQEND"); g(8, e.capa)
                else:
                    g(0, "CIRCLE"); g(8, e.capa); g(10, f'{d["c"][0]:.4f}'); g(20, f'{d["c"][1]:.4f}'); g(30, 0); g(40, f'{d["r"]:.4f}')
            elif e.tipo == "ARC":
                g(0, "ARC"); g(8, e.capa); g(10, f'{d["c"][0]:.4f}'); g(20, f'{d["c"][1]:.4f}'); g(30, 0)
                g(40, f'{d["r"]:.4f}'); g(50, d["a0"]); g(51, d["a1"])
            elif e.tipo == "TEXT":
                g(0, "TEXT"); g(8, e.capa); g(10, f'{d["p"][0]:.4f}'); g(20, f'{d["p"][1]:.4f}'); g(30, 0)
                g(40, d["h"]); g(1, d["s"].replace("\n", " ")); g(50, d["rot"])
                if d["alin"] != "izq":
                    g(72, {"centro": 1, "der": 2}[d["alin"]]); g(11, f'{d["p"][0]:.4f}'); g(21, f'{d["p"][1]:.4f}'); g(31, 0)
        g(0, "ENDSEC"); g(0, "EOF")
        return "".join(o)

    def guardar_dxf(self, ruta):
        # R12 usa la página de códigos ANSI_1252: acentos y ñ se escriben en cp1252
        with open(ruta, "w", encoding="cp1252", errors="replace", newline="\r\n") as f:
            f.write(self._dxf())
        return ruta

    # ---------- salida PDF/PNG ----------
    def figura(self):
        import matplotlib; matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.patches import Circle, Arc
        fig = plt.figure(figsize=(self.ancho / 25.4, self.alto / 25.4))
        ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, self.ancho); ax.set_ylim(0, self.alto); ax.set_aspect("equal"); ax.axis("off")
        pt_por_mm = 72 / 25.4
        for e in self.ents:
            d = e.datos; col = COLOR_PDF.get(CAPAS.get(e.capa, 7), "#1d2328")
            lw = 0.25 if e.capa in ("COTAS", "EJES", "OCULTO", "SUELO") else (0.5 if e.capa in ("ESTRIBOS",) else 0.6 if e.capa != "MARCO" else 1.0)
            if e.tipo == "LINE":
                ls = (0, (6, 3)) if d["lt"] == "DASHED" or e.capa == "OCULTO" else ((0, (12, 3, 2, 3)) if e.capa == "EJES" else "-")
                ax.plot([d["p1"][0], d["p2"][0]], [d["p1"][1], d["p2"][1]], color=col, lw=lw, linestyle=ls, solid_capstyle="butt")
            elif e.tipo == "CIRCLE":
                ax.add_patch(Circle(d["c"], d["r"], fill=d["relleno"], color=col, lw=lw))
            elif e.tipo == "ARC":
                ax.add_patch(Arc(d["c"], 2 * d["r"], 2 * d["r"], theta1=d["a0"], theta2=d["a1"], color=col, lw=lw))
            elif e.tipo == "TEXT":
                ax.text(d["p"][0], d["p"][1], d["s"], fontsize=d["h"] * pt_por_mm / 0.72, color=col, rotation=d["rot"],
                        ha={"izq": "left", "centro": "center", "der": "right"}[d["alin"]], va="baseline", family="DejaVu Sans")
        return fig

    def guardar_pdf(self, ruta):
        import matplotlib.pyplot as plt
        fig = self.figura(); fig.savefig(ruta); plt.close(fig)
        return ruta

    def guardar_png(self, ruta, dpi=110):
        import matplotlib.pyplot as plt
        fig = self.figura(); fig.savefig(ruta, dpi=dpi); plt.close(fig)
        return ruta

@dataclass
class Vista:
    """Transforma coordenadas reales (cm) a mm de papel con escala 1:esc, a partir de un origen en el papel."""
    dib: Dibujo
    x0: float
    y0: float
    esc: float   # denominador de la escala (20 → 1:20)

    def p(self, x, y):
        f = 10 / self.esc  # cm reales → mm papel
        return (self.x0 + x * f, self.y0 + y * f)

    def l(self, d):
        return d * 10 / self.esc

    def linea(self, a, b, capa="CONCRETO", tipo="CONTINUOUS"):
        self.dib.linea(self.p(*a), self.p(*b), capa, tipo)

    def polilinea(self, pts, capa="CONCRETO", cerrada=False, tipo="CONTINUOUS"):
        self.dib.polilinea([self.p(*q) for q in pts], capa, cerrada, tipo)

    def rect(self, x, y, w, h, capa="CONCRETO"):
        self.polilinea([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], capa, cerrada=True)

    def varilla(self, x, y, num, capa="ACERO"):
        self.dib.circulo(self.p(x, y), max(self.l(VARILLAS[num][0] / 2), 0.45), capa, relleno=True)

    def cota(self, a, b, texto, off_mm=6):
        self.dib.cota(self.p(*a), self.p(*b), texto, off_mm)

    def titulo(self, x, y, texto, escala=True):
        px, py = self.p(x, y)
        self.dib.texto((px, py), texto, 3.5, "TEXTO", "centro")
        self.dib.linea((px - len(texto) * 1.6, py - 1.5), (px + len(texto) * 1.6, py - 1.5), "TEXTO")
        if escala:
            self.dib.texto((px, py - 6), f"ESC. 1:{self.esc:g}", 2.2, "TEXTO", "centro")

# ---------------- hoja y cuadro de referencia ----------------
@dataclass
class DatosPlano:
    proyecto: str
    ubicacion: str = "Tijuana, B.C."
    propietario: str = ""
    contenido: str = ""
    clave: str = "E-01"
    escala: str = "Indicadas"
    fecha: str = field(default_factory=lambda: date.today().strftime("%d/%m/%Y"))
    revision: str = "0"
    dibujo: str = "Vértice"
    reviso: str = "Ing. Miguel Estrada"
    dro: str = "Ing. Miguel Estrada — DRO"
    notas: list = field(default_factory=list)

def hoja(datos: DatosPlano, ancho=900, alto=600):
    """Crea un Dibujo con marco, cuadro de referencia Vértice (franja derecha) y notas."""
    d = Dibujo(ancho, alto)
    m = 10
    d.rect(m, m, ancho - 2 * m, alto - 2 * m, "MARCO")
    xc = ancho - m - 175
    d.linea((xc, m), (xc, alto - m), "MARCO")
    x = xc + 6; w = 175 - 12
    # encabezado
    y = alto - m - 22
    d.texto((x, y), "VÉRTICE", 9, "CUADRO")
    d.texto((x, y - 7), "Ingeniería, Arquitectura y Proyectos", 3.2, "CUADRO")
    d.texto((x, y - 12.5), "Tijuana, Baja California", 2.4, "CUADRO")
    y -= 20
    d.linea((xc, y), (ancho - m, y), "CUADRO")
    # notas generales
    yn = y - 7
    d.texto((x, yn), "NOTAS GENERALES", 3, "NOTAS"); yn -= 6
    for nota in datos.notas:
        for linea in _envolver(nota, 62):
            d.texto((x, yn), linea, 2.1, "NOTAS"); yn -= 3.6
        yn -= 1.2
    # bloque de datos (de abajo hacia arriba)
    filas = [("PROYECTO", datos.proyecto), ("UBICACIÓN", datos.ubicacion), ("PROPIETARIO", datos.propietario),
             ("CONTENIDO", datos.contenido)]
    yb = m + 118
    d.linea((xc, yb), (ancho - m, yb), "CUADRO")
    yy = yb - 3
    for et, val in filas:
        d.texto((x, yy - 3), et, 1.8, "CUADRO")
        for i, ln in enumerate(_envolver(val, 48)[:2]):
            d.texto((x, yy - 7.5 - i * 4), ln, 2.8, "CUADRO")
        yy -= 16
        d.linea((xc, yy), (ancho - m, yy), "CUADRO")
    # celdas inferiores
    celdas = [("CLAVE", datos.clave, 7), ("ESCALA", datos.escala, 3), ("FECHA", datos.fecha, 3), ("REV.", datos.revision, 3)]
    cw = (175) / len(celdas)
    for i, (et, val, h) in enumerate(celdas):
        cx = xc + i * cw
        if i: d.linea((cx, m + 30), (cx, yy), "CUADRO")
        d.texto((cx + 3, yy - 4), et, 1.8, "CUADRO")
        d.texto((cx + 3, m + 34), val, h, "CUADRO")
    d.linea((xc, m + 30), (ancho - m, m + 30), "CUADRO")
    d.texto((x, m + 24), f"DIBUJÓ: {datos.dibujo}    REVISÓ: {datos.reviso}", 2.2, "CUADRO")
    d.texto((x, m + 18), f"DRO / CORRESPONSABLE: {datos.dro}", 2.2, "CUADRO")
    d.texto((x, m + 9), "FIRMA: ______________________________", 2.4, "CUADRO")
    d.texto((x, m + 3.5), LEYENDA.upper(), 1.9, "CUADRO")
    d.area_util = (m + 6, m + 6, xc - 6, alto - m - 6)
    return d

def _envolver(texto, n):
    pal, lineas, act = str(texto).split(), [], ""
    for p in pal:
        if len(act) + len(p) + 1 > n:
            lineas.append(act); act = p
        else:
            act = (act + " " + p).strip()
    if act: lineas.append(act)
    return lineas or [""]

NOTAS_ESTRUCTURALES = [
    "Cotas en cm, niveles en m. Las cotas rigen sobre el dibujo; verificar en obra contra planos arquitectónicos.",
    "Concreto f'c indicado en cada elemento; agregado máximo 3/4\". Revenimiento según especificación.",
    "Acero de refuerzo NMX-B-506 / ASTM A615 grado 42 (fy = 4200 kg/cm²).",
    "Recubrimientos libres: zapatas 7.5 cm, columnas y trabes 4 cm, losas 2.5 cm.",
    "Traslapes clase B según tabla; no traslapar más del 50 % del acero en una misma sección.",
    "Ganchos estándar a 90° y 135° en estribos según ACI 318-19 cap. 25.",
    "Capacidad de carga del terreno según estudio de mecánica de suelos; si no existe, el valor usado es un supuesto a validar.",
    "Diseño conforme al reglamento de edificación del municipio, NTC y MDOC-CFE Sismo; ACI 318-19 como referencia.",
]

# ---------------- detalles estructurales ----------------
def seccion_rectangular(dib, x0, y0, esc, nombre, b, h, rec, sup, inf, estribo=3, sep_estribo="", fc=250, lat=None):
    """Sección de trabe o columna. sup/inf: lista de (n, num). lat: (n por cara, num) para barras laterales."""
    v = Vista(dib, x0, y0, esc)
    v.rect(0, 0, b, h, "CONCRETO")
    de = VARILLAS[estribo][0]
    v.rect(rec, rec, b - 2 * rec, h - 2 * rec, "ESTRIBOS")
    # gancho 135° esquemático
    v.linea((rec, h - rec), (rec + 4, h - rec - 4), "ESTRIBOS")
    v.linea((rec + 1.2, h - rec), (rec + 5.2, h - rec - 4), "ESTRIBOS")
    def fila(barras, y):
        lista = [num for n, num in barras for _ in range(n)]
        if not lista: return
        dmax = max(VARILLAS[nm][0] for nm in lista)
        xa, xb = rec + de + dmax / 2, b - rec - de - dmax / 2
        for i, num in enumerate(lista):
            x = xa if len(lista) == 1 else xa + (xb - xa) * i / (len(lista) - 1)
            v.varilla(x, y, num)
    dmx_s = max([VARILLAS[nm][0] for _, nm in sup] or [0])
    dmx_i = max([VARILLAS[nm][0] for _, nm in inf] or [0])
    fila(sup, h - rec - de - dmx_s / 2)
    fila(inf, rec + de + dmx_i / 2)
    if lat:
        n, num = lat
        for i in range(1, n + 1):
            y = rec + (h - 2 * rec) * i / (n + 1)
            v.varilla(rec + de + VARILLAS[num][0] / 2, y, num); v.varilla(b - rec - de - VARILLAS[num][0] / 2, y, num)
    v.cota((0, 0), (b, 0), f"{b:g}", -6)
    v.cota((b, 0), (b, h), f"{h:g}", 6)
    v.titulo(b / 2, -16 * esc / 10, nombre)
    tx, ty = v.p(b, h)
    lineas = []
    if sup: lineas.append("Sup.: " + " + ".join(f"{n}#{nm}" for n, nm in sup))
    if inf: lineas.append("Inf.: " + " + ".join(f"{n}#{nm}" for n, nm in inf))
    if lat: lineas.append(f"Lat.: {lat[0]*2}#{lat[1]}")
    lineas.append(f"E#{estribo} {sep_estribo}")
    lineas.append(f"f'c = {fc} kg/cm²")
    for i, s in enumerate(lineas):
        dib.texto((tx + 10, ty - 3 - i * 4.2), s, 2.4, "TEXTO")

def elevacion_trabe(dib, x0, y0, esc, nombre, L, h, apoyo, sup, inf, estribo=3, s_conf=10, s_centro=20, zona_conf=None):
    """Elevación de trabe entre caras de apoyo con zonas de confinamiento (2h por omisión)."""
    v = Vista(dib, x0, y0, esc)
    zc = zona_conf or 2 * h
    v.rect(-apoyo, 0, apoyo, h, "OCULTO"); v.rect(L, 0, apoyo, h, "OCULTO")
    v.linea((0, 0), (L, 0)); v.linea((0, h), (L, h))
    rec = 4
    v.linea((-apoyo + rec, h - rec), (L + apoyo - rec, h - rec), "ACERO")
    v.linea((-apoyo + rec, rec), (L + apoyo - rec, rec), "ACERO")
    v.linea((-apoyo + rec, h - rec), (-apoyo + rec, h - rec - 15), "ACERO")
    v.linea((L + apoyo - rec, h - rec), (L + apoyo - rec, h - rec - 15), "ACERO")
    x = 5
    while x <= L - 5 + 1e-6:
        v.linea((x, rec - 1), (x, h - rec + 1), "ESTRIBOS")
        x += s_conf if (x < zc or x > L - zc) else s_centro
    v.cota((0, 0), (zc, 0), f"{zc:g}", -6); v.cota((L - zc, 0), (L, 0), f"{zc:g}", -6)
    v.cota((0, 0), (L, 0), f"{L:g}", -13)
    v.titulo(L / 2, -26 * esc / 10, nombre)
    px, py = v.p(0, h)
    dib.texto((px, py + 6), f"Sup.: {' + '.join(f'{n}#{nm}' for n, nm in sup)} corridas · Inf.: {' + '.join(f'{n}#{nm}' for n, nm in inf)}", 2.4)
    dib.texto((px, py + 11), f"E#{estribo}: 1a @ 5 cm, resto @ {s_conf:g} cm en {zc:g} cm de cada extremo; centro @ {s_centro:g} cm", 2.4)

def detalle_zapata(dib, x0, y0, esc, nombre, B, L, h, c1, c2, armado, Df=120, plantilla=5, dado=None):
    """Planta y corte de zapata aislada. Dimensiones en cm."""
    v = Vista(dib, x0, y0, esc)
    # planta
    v.rect(0, 0, B, L)
    v.rect((B - c1) / 2, (L - c2) / 2, c1, c2)
    for i in range(1, 8):
        v.linea((B * i / 8, 7.5), (B * i / 8, L - 7.5), "ACERO")
        v.linea((7.5, L * i / 8), (B - 7.5, L * i / 8), "ACERO")
    v.cota((0, 0), (B, 0), f"{B:g}", -6); v.cota((B, 0), (B, L), f"{L:g}", 6)
    v.titulo(B / 2, -16 * esc / 10, f"{nombre} — PLANTA")
    # corte
    xc = B + 70
    v.rect(xc, 0, B, h)
    v.rect(xc + (B - c1) / 2, h, c1, Df - h)
    v.rect(xc - 10, -plantilla, B + 20, plantilla, "SUELO")
    v.linea((xc + 7.5, 7.5), (xc + B - 7.5, 7.5), "ACERO")
    for i in range(9):
        v.varilla(xc + 7.5 + (B - 15) * i / 8, 9.5, 4)
    v.linea((xc - 30, Df), (xc + B + 30, Df), "SUELO")
    v.cota((xc, 0), (xc, h), f"{h:g}", -6)
    v.cota((xc + B, 0), (xc + B, Df), f"Df={Df:g}", 8)
    v.titulo(xc + B / 2, -16 * esc / 10, f"{nombre} — CORTE")
    px, py = v.p(xc, Df)
    dib.texto((px, py + 5), f"Parrilla: {armado}", 2.4)
    dib.texto((px, py + 9.5), f"Plantilla f'c=100 kg/cm² de {plantilla:g} cm · recubrimiento 7.5 cm", 2.4)

def tabla(dib, x, y, encabezados, filas, anchos, h_fila=6, titulo=None):
    """Tabla en el plano (cuadro de armados, cuadro de cargas, etc.)."""
    if titulo:
        dib.texto((x, y + 3), titulo, 3, "TEXTO")
    W = sum(anchos)
    n = len(filas) + 1
    dib.rect(x, y - n * h_fila, W, n * h_fila, "TEXTO")
    for i in range(1, n):
        dib.linea((x, y - i * h_fila), (x + W, y - i * h_fila), "TEXTO")
    cx = x
    for a in anchos[:-1]:
        cx += a; dib.linea((cx, y), (cx, y - n * h_fila), "TEXTO")
    for r, fila in enumerate([encabezados] + filas):
        cx = x
        for a, val in zip(anchos, fila):
            dib.texto((cx + 1.5, y - r * h_fila - h_fila + 1.8), val, 2.2 if r else 2.3, "TEXTO")
            cx += a

def planta_ejes(dib, x0, y0, esc, ejes_x, ejes_y, nombres_x=None, nombres_y=None, ext=150):
    """Ejes en planta. ejes_x/ejes_y: posiciones en cm (acumuladas desde 0)."""
    v = Vista(dib, x0, y0, esc)
    nx = nombres_x or [str(i + 1) for i in range(len(ejes_x))]
    ny = nombres_y or [chr(65 + i) for i in range(len(ejes_y))]
    Y1, X1 = ejes_y[-1], ejes_x[-1]
    for x, n in zip(ejes_x, nx):
        v.linea((x, -ext), (x, Y1 + ext), "EJES")
        cx, cy = v.p(x, Y1 + ext); dib.circulo((cx, cy + 4), 4, "EJES"); dib.texto((cx, cy + 3), n, 3, "EJES", "centro")
    for y, n in zip(ejes_y, ny):
        v.linea((-ext, y), (X1 + ext, y), "EJES")
        cx, cy = v.p(-ext, y); dib.circulo((cx - 4, cy), 4, "EJES"); dib.texto((cx - 4, cy - 1.2), n, 3, "EJES", "centro")
    for a, b in zip(ejes_x, ejes_x[1:]):
        v.cota((a, Y1 + ext * 0.6), (b, Y1 + ext * 0.6), f"{b - a:g}", 0)
    for a, b in zip(ejes_y, ejes_y[1:]):
        v.cota((X1 + ext * 0.6, a), (X1 + ext * 0.6, b), f"{b - a:g}", 0)
    return v
