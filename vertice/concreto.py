"""Diseño de concreto reforzado — ACI 318-19 expresado en kgf y cm (f'c, fy en kg/cm²).

Conversión de las expresiones en MPa: √f'c[MPa] = 0.3132·√f'c[kg/cm²]; 1 MPa = 10.197 kg/cm².
Por eso 0.17λ√f'c (MPa) → 0.53λ√f'c y 0.33√f'c → 1.06√f'c (kg/cm²).
Momentos en kg·cm salvo que se indique t·m.
"""
from dataclasses import dataclass, field
from math import sqrt, ceil, floor
from .materiales import Concreto, Acero, VARILLAS, area

PHI_FLEX = 0.90
PHI_CORTE = 0.75
PHI_COMP_EST = 0.65   # columnas con estribos
PHI_COMP_ZUN = 0.75   # columnas zunchadas

def tm_a_kgcm(m_tm):
    return m_tm * 1e5

def kgcm_a_tm(m):
    return m / 1e5

# ---------------- flexión ----------------
@dataclass
class ResultadoFlexion:
    As_req: float
    As_min: float
    As_max: float
    As_diseno: float
    rho: float
    a: float
    c: float
    eps_t: float
    phi: float
    phiMn: float
    cumple: bool
    notas: list = field(default_factory=list)

def as_minimo(b, d, fc, fy):
    """ACI 9.6.1.2: max(0.8√f'c, 14)·b·d/fy (kg/cm²)."""
    return max(0.8 * sqrt(fc), 14.0) * b * d / fy

def phi_por_deformacion(eps_t, ey, espiral=False):
    """ACI 21.2.2: transición entre compresión controlada (εt ≤ εy) y tensión controlada (εt ≥ εy+0.003)."""
    pc = PHI_COMP_ZUN if espiral else PHI_COMP_EST
    if eps_t <= ey:
        return pc
    if eps_t >= ey + 0.003:
        return PHI_FLEX
    return pc + (PHI_FLEX - pc) * (eps_t - ey) / 0.003

def flexion_rectangular(Mu, b, d, conc=Concreto(), acero=Acero()):
    """Acero requerido para una sección rectangular simplemente reforzada. Mu en kg·cm."""
    fc, fy = conc.fc, acero.fy
    notas = []
    Rn = Mu / (PHI_FLEX * b * d ** 2)
    disc = 1 - 2 * Rn / (0.85 * fc)
    if disc <= 0:
        return ResultadoFlexion(float("nan"), 0, 0, float("nan"), float("nan"), 0, 0, 0, 0, 0, False,
                                ["La sección no alcanza: aumenta peralte o usa acero de compresión"])
    rho = 0.85 * fc / fy * (1 - sqrt(disc))
    As_req = rho * b * d
    As_min = as_minimo(b, d, fc, fy)
    # As máximo para εt = 0.005 (tensión controlada)
    c_max = 0.003 / (0.003 + 0.005) * d
    As_max = 0.85 * fc * conc.beta1 * c_max * b / fy
    As = max(As_req, As_min)
    if As_req < As_min:
        notas.append("Rige acero mínimo (ACI 9.6.1.2)")
    a = As * fy / (0.85 * fc * b)
    c = a / conc.beta1
    eps_t = 0.003 * (d - c) / c
    phi = phi_por_deformacion(eps_t, acero.ey)
    phiMn = phi * As * fy * (d - a / 2)
    cumple = eps_t >= 0.004 and phiMn >= Mu * 0.999
    if eps_t < 0.005:
        notas.append(f"εt = {eps_t:.4f} < 0.005: no es tensión controlada, φ = {phi:.3f}")
    if eps_t < 0.004:
        notas.append("εt < 0.004: viola ACI 9.3.3.1 para vigas; aumenta peralte")
    return ResultadoFlexion(As_req, As_min, As_max, As, As / (b * d), a, c, eps_t, phi, phiMn, cumple, notas)

def momento_resistente(As, b, d, conc=Concreto(), acero=Acero()):
    """φMn de sección rectangular con As dada (kg·cm)."""
    a = As * acero.fy / (0.85 * conc.fc * b)
    c = a / conc.beta1
    eps_t = 0.003 * (d - c) / c
    phi = phi_por_deformacion(eps_t, acero.ey)
    return phi * As * acero.fy * (d - a / 2)

def proponer_varillas(As, opciones=(3, 4, 5, 6, 8), n_min=2, n_max=10, b=None, rec=4.0, estribo=3, agregado=2.0):
    """Elige la combinación con menor exceso de área que quepa en el ancho b (separación libre ≥ max(2.5 cm, db, 4/3·agregado))."""
    mejor = None
    for num in opciones:
        db, a1 = VARILLAS[num][0], VARILLAS[num][1]
        n = max(n_min, ceil(As / a1 - 1e-9))
        if n > n_max:
            continue
        if b is not None:
            libre = (b - 2 * rec - 2 * VARILLAS[estribo][0] - n * db) / (n - 1) if n > 1 else b
            if libre < max(2.5, db, 4 / 3 * agregado):
                continue
        exceso = n * a1 - As
        if mejor is None or exceso < mejor[2]:
            mejor = (n, num, exceso)
    if mejor is None:
        return None
    n, num, _ = mejor
    return {"n": n, "num": num, "As": n * VARILLAS[num][1], "texto": f"{n} vars #{num} ({VARILLAS[num][3]})"}

# ---------------- cortante ----------------
@dataclass
class ResultadoCortante:
    Vc: float
    phiVc: float
    Vs_req: float
    s_req: float
    s_max: float
    s_diseno: float
    phiVn: float
    cumple: bool
    notas: list = field(default_factory=list)

def cortante_viga(Vu, b, d, Av_num=3, ramas=2, conc=Concreto(), fyt=4200.0, lam=1.0):
    """ACI 22.5.5.1 (forma simplificada) y 9.7.6.2: Vu en kg."""
    fc = conc.fc
    Vc = 0.53 * lam * sqrt(fc) * b * d
    Av = ramas * VARILLAS[Av_num][1]
    notas = []
    Vs = max(0.0, Vu / PHI_CORTE - Vc)
    Vs_lim = 2.1 * sqrt(fc) * b * d  # 0.66√f'c MPa
    if Vs > Vs_lim:
        notas.append("Vs excede 2.1√f'c·b·d: aumenta la sección (ACI 22.5.1.2)")
    s_req = Av * fyt * d / Vs if Vs > 0 else float("inf")
    s_max = min(d / 2, 60.0) if Vs <= 1.06 * sqrt(fc) * b * d else min(d / 4, 30.0)
    s_avmin = Av * fyt / (max(0.2 * sqrt(fc), 3.5) * b)
    s = min(s_req, s_max, s_avmin) if Vu > 0.5 * PHI_CORTE * Vc else min(s_max, s_avmin)
    s = floor(s * 2) / 2  # redondeo a 0.5 cm hacia abajo
    phiVn = PHI_CORTE * (Vc + Av * fyt * d / s)
    return ResultadoCortante(Vc, PHI_CORTE * Vc, Vs, s_req, s_max, s, phiVn, phiVn >= Vu and Vs <= Vs_lim, notas)

# ---------------- columnas ----------------
@dataclass
class Capa:
    As: float
    y: float   # distancia desde la fibra más comprimida, cm

def capas_rectangular(b, h, num_esq=5, n_cara_b=2, n_cara_h=2, rec=4.0, estribo=3):
    """Distribuye barras: n_cara_b barras en cada cara de ancho b (incluye esquinas) y n_cara_h en cada cara de h.
    La flexión es alrededor del eje paralelo a b (peralte h)."""
    db = VARILLAS[num_esq][0]
    a1 = VARILLAS[num_esq][1]
    y1 = rec + VARILLAS[estribo][0] + db / 2
    y2 = h - y1
    capas = [Capa(n_cara_b * a1, y1), Capa(n_cara_b * a1, y2)]
    inter = n_cara_h - 2
    for i in range(1, inter + 1):
        y = y1 + (y2 - y1) * i / (inter + 1)
        capas.append(Capa(2 * a1, y))
    return sorted(capas, key=lambda c: c.y)

def punto_diagrama(c, b, h, capas, conc=Concreto(), acero=Acero()):
    """Pn, Mn (kg, kg·cm, respecto al centroide plástico ≈ h/2) para profundidad de eje neutro c."""
    fc, fy, Es = conc.fc, acero.fy, acero.Es
    a = min(conc.beta1 * c, h)
    Cc = 0.85 * fc * a * b
    P = Cc
    M = Cc * (h / 2 - a / 2)
    eps_t = 0.0
    for cp in capas:
        eps = 0.003 * (c - cp.y) / c
        fs = max(-fy, min(fy, eps * Es))
        if cp.y < a:  # descontar concreto desplazado
            fs -= 0.85 * fc
        F = cp.As * fs
        P += F
        M += F * (h / 2 - cp.y)
    dt = max(cp.y for cp in capas)
    eps_t = 0.003 * (dt - c) / c
    return P, M, eps_t

def diagrama_interaccion(b, h, capas, conc=Concreto(), acero=Acero(), n=60):
    """Lista de puntos (φPn, φMn, Pn, Mn) en kg y kg·cm, de compresión pura a tensión pura."""
    Ast = sum(c.As for c in capas)
    Ag = b * h
    P0 = 0.85 * conc.fc * (Ag - Ast) + acero.fy * Ast
    Pmax = 0.80 * PHI_COMP_EST * P0
    pts = []
    for i in range(n):
        c = h * 3 * (1 - i / n) + 0.5
        P, M, et = punto_diagrama(c, b, h, capas, conc, acero)
        phi = phi_por_deformacion(et, acero.ey)
        pts.append((min(phi * P, Pmax), phi * M, P, M))
    pts.append((-PHI_FLEX * acero.fy * Ast, 0.0, -acero.fy * Ast, 0.0))
    return pts, Pmax

def revisar_columna(Pu, Mu, b, h, capas, conc=Concreto(), acero=Acero()):
    """Revisa (Pu, Mu) contra el diagrama (kg, kg·cm). Regresa φMn a Pu y la relación demanda/capacidad."""
    Ast = sum(c.As for c in capas)
    rho = Ast / (b * h)
    pts, Pmax = diagrama_interaccion(b, h, capas, conc, acero, n=200)
    notas = []
    if not 0.01 <= rho <= 0.08:
        notas.append(f"ρ = {rho:.3%} fuera de 1 %–8 % (ACI 10.6.1.1)")
    if Pu > Pmax:
        return {"cumple": False, "rho": rho, "phiMn": 0.0, "DC": Pu / Pmax, "Pmax": Pmax,
                "notas": notas + ["Pu excede φPn,max"]}
    phiMn = 0.0
    for (p1, m1, *_), (p2, m2, *_) in zip(pts, pts[1:]):
        if (p1 - Pu) * (p2 - Pu) <= 0 and p1 != p2:
            m = m1 + (m2 - m1) * (Pu - p1) / (p2 - p1)
            phiMn = max(phiMn, m)
    DC = Mu / phiMn if phiMn > 0 else float("inf")
    return {"cumple": DC <= 1.0 and not notas, "rho": rho, "phiMn": phiMn, "DC": DC, "Pmax": Pmax, "notas": notas}

def estribos_columna(b, h, num_long=5, num_est=3, d=None):
    """ACI 25.7.2.1: s ≤ min(16 db long, 48 db estribo, menor dimensión)."""
    s = min(16 * VARILLAS[num_long][0], 48 * VARILLAS[num_est][0], min(b, h))
    return floor(s)

# ---------------- losas ----------------
def espesor_min_losa_una_direccion(L, condicion="ambos_continuos", fy=4200.0):
    """ACI Tabla 7.3.1.1 (cm, L en cm), corregida por fy: ×(0.4+fy/7000) con fy en kg/cm²."""
    div = {"simple": 20, "un_extremo_continuo": 24, "ambos_continuos": 28, "voladizo": 10}[condicion]
    return L / div * (0.4 + fy / 7000)

def espesor_min_losa_perimetral(ln_largo, ln_corto, fy=4200.0, alfa_fm=2.0):
    """ACI Tabla 8.3.1.2 para losas en dos direcciones con vigas (αfm > 2): h = ln(0.8+fy/14000)/(36+9β) ≥ 9 cm."""
    beta = ln_largo / ln_corto
    if alfa_fm > 2.0:
        return max(9.0, ln_largo * (0.8 + fy / 14000) / (36 + 9 * beta))
    return max(12.5, ln_largo * (0.8 + fy / 14000) / (36 + 5 * beta * (alfa_fm - 0.2)))

def acero_temperatura(b, h, fy=4200.0):
    """ACI 24.4.3.2: 0.0018·b·h para fy = 4200."""
    return 0.0018 * b * h * (4200 / fy if fy > 4200 else 1)

def separacion_losa(As_req_por_m, num=3, h=None):
    """Separación (cm) de varillas para un As por metro; máx. min(3h, 45 cm) (ACI 7.7.2.3)."""
    s = VARILLAS[num][1] * 100 / As_req_por_m
    if h:
        s = min(s, 3 * h, 45)
    return floor(s)

# ---------------- desarrollo y traslapes ----------------
def longitud_desarrollo(num, fc=250.0, fy=4200.0, superior=False, epoxico=False, lam=1.0):
    """ACI 25.4.2.3 (expresión simplificada con separación y recubrimiento adecuados), cm.
    #6 y menores: ld = fy·ψt·ψe/(6.7λ√f'c)·db; #7 y mayores: /5.4."""
    db = VARILLAS[num][0]
    psi_t = 1.3 if superior else 1.0
    psi_e = 1.5 if epoxico else 1.0
    k = 6.7 if num <= 6 else 5.4
    ld = fy * min(psi_t * psi_e, 1.7) / (k * lam * sqrt(fc)) * db
    return max(30.0, ld)

def traslape(num, **kw):
    """Clase B = 1.3·ld (ACI 25.5.2)."""
    return max(30.0, 1.3 * longitud_desarrollo(num, **kw))

def gancho_estandar(num, fc=250.0, fy=4200.0, lam=1.0):
    """ldh ≈ 0.075·fy·db/(λ√f'c) ≥ max(8db, 15 cm) — forma ACI 318-14; para 318-19 aplicar factores ψ."""
    db = VARILLAS[num][0]
    return max(8 * db, 15.0, 0.075 * fy * db / (lam * sqrt(fc)))
