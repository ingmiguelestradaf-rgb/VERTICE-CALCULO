"""Zapatas aisladas y corridas — ACI 318-19 cap. 13 y 22 en kgf-cm.

Las cargas de servicio se usan para dimensionar con la capacidad admisible del estudio de mecánica de suelos;
las cargas factorizadas para cortante y flexión. Si no hay EMS, q_adm es un SUPUESTO A VALIDAR.
"""
from dataclasses import dataclass, field
from math import sqrt, ceil, floor
from .materiales import Concreto, Acero, VARILLAS
from .concreto import PHI_CORTE, PHI_FLEX, flexion_rectangular

@dataclass
class ResultadoZapata:
    B: float      # cm (lado en dirección analizada)
    L: float      # cm
    h: float      # cm
    d: float      # cm
    q_serv: float     # t/m²
    qu: float         # t/m² factorizada
    punz_Vu: float
    punz_phiVc: float
    corte_Vu: float
    corte_phiVc: float
    Mu: float         # kg·cm en el ancho L
    As: float         # cm² en el ancho L
    armado: str
    cumple: bool
    notas: list = field(default_factory=list)

def zapata_aislada(P_serv, Pu, c1, c2, q_adm, Df=1.2, gamma_rell=1.8, fc=250.0, fy=4200.0,
                   rec=7.5, num=4, h_min=25.0, cuadrada=True, Mu_col=0.0):
    """P_serv, Pu en t; c1, c2 columna en cm; q_adm en t/m²; Df profundidad de desplante en m.
    Considera el peso de zapata y relleno restando γ·Df de la capacidad. Mu_col (t·m) agrega excentricidad simple."""
    notas = []
    q_neta = q_adm - gamma_rell * Df
    if q_neta <= 0:
        raise ValueError("q_adm insuficiente para la profundidad de desplante")
    A = P_serv / q_neta  # m²
    if cuadrada:
        B = L = ceil(sqrt(A) * 100 / 5) * 5
    else:
        L = ceil(sqrt(A * c2 / c1) * 100 / 5) * 5
        B = ceil(A * 1e4 / L / 5) * 5
    conc = Concreto(fc)
    db = VARILLAS[num][0]
    h = h_min
    for _ in range(40):
        d = h - rec - db
        qu = Pu / (B * L / 1e4)  # t/m²
        quk = qu * 1000 / 1e4      # kg/cm²
        # punzonamiento a d/2
        b0 = 2 * (c1 + d) + 2 * (c2 + d)
        Vu_p = quk * (B * L - (c1 + d) * (c2 + d))
        beta = max(c1, c2) / min(c1, c2)
        vc = min(1.06, 0.53 * (1 + 2 / beta), 0.27 * (40 * d / b0 + 2)) * sqrt(fc)
        phiVc_p = PHI_CORTE * vc * b0 * d
        # cortante en una dirección a d de la cara
        vol = (B - c1) / 2 - d
        Vu_1 = quk * max(vol, 0) * L
        phiVc_1 = PHI_CORTE * 0.53 * sqrt(fc) * L * d
        if Vu_p <= phiVc_p and Vu_1 <= phiVc_1 and d >= 15:
            break
        h += 5
    vflex = (B - c1) / 2
    Mu = quk * L * vflex ** 2 / 2  # momento en la cara de la columna
    fl = flexion_rectangular(Mu, L, d, conc, Acero(fy))
    As_temp = 0.0018 * L * h
    As = max(fl.As_diseno if fl.As_diseno == fl.As_diseno else 0, As_temp)
    if As == As_temp:
        notas.append("Rige acero por contracción y temperatura 0.0018·b·h (ACI 8.6.1.1)")
    n = ceil(As / VARILLAS[num][1])
    s = floor((L - 2 * rec) / (n - 1)) if n > 1 else L
    s = min(s, 3 * h, 45)
    n = ceil((L - 2 * rec) / s) + 1
    if Mu_col:
        e = Mu_col / Pu * 100  # cm
        if e > B / 6:
            notas.append(f"Excentricidad {e:.1f} cm > B/6: revisar presión con distribución triangular")
        notas.append("Con momento en la columna: revisar presión máxima q = P/A·(1+6e/B) ≤ q_adm")
    return ResultadoZapata(B, L, h, d, round(P_serv / (B * L / 1e4), 2), round(qu, 2), Vu_p, phiVc_p, Vu_1, phiVc_1,
                           Mu, n * VARILLAS[num][1], f"#{num} @ {s:.0f} cm ambos sentidos ({n} vars por sentido)",
                           Vu_p <= phiVc_p and Vu_1 <= phiVc_1, notas)

def zapata_corrida(w_serv, wu, ancho_muro, q_adm, Df=1.0, gamma_rell=1.8, fc=250.0, fy=4200.0, rec=7.5, num=4, h_min=20.0):
    """Zapata corrida bajo muro: w en t/m. Regresa ancho B (cm), peralte y acero transversal por metro."""
    q_neta = q_adm - gamma_rell * Df
    B = max(50, ceil(w_serv / q_neta * 100 / 5) * 5)
    h = h_min
    db = VARILLAS[num][0]
    while True:
        d = h - rec - db
        quk = wu / (B / 100) * 1000 / 1e4
        vol = (B - ancho_muro) / 2
        Vu = quk * max(vol - d, 0) * 100
        phiVc = PHI_CORTE * 0.53 * sqrt(fc) * 100 * d
        if Vu <= phiVc or h > 80:
            break
        h += 5
    Mu = quk * 100 * vol ** 2 / 2
    fl = flexion_rectangular(Mu, 100, d, Concreto(fc), Acero(fy))
    As = max(fl.As_diseno, 0.0018 * 100 * h)
    s = min(floor(VARILLAS[num][1] * 100 / As), 3 * h, 45)
    return {"B": B, "h": h, "d": d, "q_serv": w_serv / (B / 100), "Vu": Vu, "phiVc": phiVc,
            "As_m": As, "armado": f"#{num} @ {s} cm transversal + 4 #3 longitudinal mínimo", "cumple": Vu <= phiVc}
