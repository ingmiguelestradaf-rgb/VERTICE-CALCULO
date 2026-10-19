"""Análisis sísmico.

Camino recomendado: obtener el espectro del sitio con PRODISIS (CFE, Manual de Diseño de Obras Civiles,
Diseño por Sismo 2015) y cargarlo con `Espectro.desde_puntos` o `Espectro.desde_csv`.
`Espectro.cfe_parametrico` reproduce la forma espectral del MDOC-CFE 2015 a partir de los parámetros
que entrega PRODISIS (a0, c, Ta, Tb, k, r); úsalo solo para estudios previos y verifica contra PRODISIS.

Unidades: aceleraciones en fracción de g, pesos en t o kg (consistentes), alturas en m.
"""
from dataclasses import dataclass, field
from math import sqrt, pi
import csv

G = 9.81

# Distorsiones permisibles de referencia (verificar contra la tabla de la norma adoptada por el municipio)
DISTORSIONES_LIMITE = {
    "marco_concreto_ductil_Q3_4": 0.030,
    "marco_concreto_ductilidad_limitada_Q2": 0.015,
    "marco_concreto_con_muros": 0.015,
    "muros_concreto": 0.010,
    "mamposteria_confinada_piezas_macizas": 0.0035,
    "mamposteria_confinada_piezas_huecas": 0.0025,
    "mamposteria_refuerzo_interior": 0.002,
    "marco_acero_ductil": 0.030,
}

@dataclass
class Espectro:
    T: list            # periodos s (ascendente)
    a: list            # aceleración elástica (fracción de g)
    Q: float = 2.0
    R0: float = 2.0    # sobrerresistencia índice
    rho: float = 1.0   # redundancia
    alfa: float = 1.0  # corrección por irregularidad (≤1)
    Ta: float = 0.1
    Tb: float = 0.6
    k: float = 1.0
    beta: float = 1.0  # amortiguamiento (1 para 5 %)
    origen: str = "puntos"

    @classmethod
    def desde_puntos(cls, puntos, **kw):
        pts = sorted(puntos)
        return cls([p[0] for p in pts], [p[1] for p in pts], **kw)

    @classmethod
    def desde_csv(cls, ruta, col_T=0, col_a=1, **kw):
        pts = []
        with open(ruta, newline="", encoding="utf-8-sig") as f:
            for row in csv.reader(f):
                try:
                    pts.append((float(row[col_T]), float(row[col_a])))
                except (ValueError, IndexError):
                    continue
        e = cls.desde_puntos(pts, **kw)
        e.origen = f"CSV {ruta}"
        return e

    @classmethod
    def cfe_parametrico(cls, a0, c, Ta, Tb, k, r, Tc=None, beta=1.0, Tmax=4.0, n=200, **kw):
        """Forma espectral MDOC-CFE 2015 (Diseño por Sismo, 3.1.6):
        a = a0+(βc−a0)T/Ta (T<Ta); βc (Ta≤T<Tb); βc·p·(Tb/T)^r (Tb≤T<Tc); βc·p·(Tb/Tc)^r·(Tc/T)² (T≥Tc),
        p = k+(1−k)(Tb/T)². Tc = 2 s si Tb < 2 s, si no Tc = Tb."""
        Tc = Tc or (2.0 if Tb < 2.0 else Tb)
        Ts, As = [], []
        for i in range(n + 1):
            T = Tmax * i / n
            if T < Ta:
                a = a0 + (beta * c - a0) * T / Ta
            elif T < Tb:
                a = beta * c
            else:
                p = k + (1 - k) * (Tb / T) ** 2
                a = beta * c * p * (Tb / T) ** r if T < Tc else beta * c * p * (Tb / Tc) ** r * (Tc / T) ** 2
            Ts.append(T); As.append(a)
        e = cls(Ts, As, Ta=Ta, Tb=Tb, k=k, beta=beta, origen="CFE-2015 paramétrico", **kw)
        return e

    def elastica(self, T):
        if T <= self.T[0]:
            return self.a[0]
        for i in range(1, len(self.T)):
            if T <= self.T[i]:
                t0, t1, a0, a1 = self.T[i - 1], self.T[i], self.a[i - 1], self.a[i]
                return a0 + (a1 - a0) * (T - t0) / (t1 - t0)
        return self.a[-1]

    def Qp(self, T):
        """Factor de reducción por ductilidad Q' (forma CFE-2015)."""
        Q, Ta, Tb, k, b = self.Q, self.Ta, self.Tb, self.k, self.beta
        if T <= Ta:
            q = 1 + (Q - 1) * sqrt(b / k) * T / Ta
        elif T <= Tb:
            q = 1 + (Q - 1) * sqrt(b / k)
        else:
            p = k + (1 - k) * (Tb / T) ** 2
            q = 1 + (Q - 1) * sqrt(b * p / k)
        return max(1.0, q * self.alfa)

    def R(self, T):
        """Sobrerresistencia: R0 para T>Ta; transición desde 1 para T≤Ta."""
        if T >= self.Ta:
            return self.R0
        return 1 + (self.R0 - 1) * sqrt(T / self.Ta)

    def diseno(self, T):
        """Ordenada reducida de diseño a/(Q'·R·ρ)."""
        return self.elastica(T) / (self.Qp(T) * self.R(T) * self.rho)

def periodo_empirico(H, sistema="marco_concreto"):
    """Periodo aproximado Ta = Ct·H^x (ASCE 7-16 12.8.2.1, H en m). Úsalo solo como primera estimación."""
    Ct, x = {"marco_concreto": (0.0466, 0.9), "marco_acero": (0.0724, 0.8),
             "muros": (0.0488, 0.75), "mamposteria": (0.0488, 0.75)}[sistema]
    return Ct * H ** x

@dataclass
class Nivel:
    nombre: str
    peso: float      # W del nivel (CM + CV instantánea), t
    altura: float    # altura del nivel sobre desplante, m
    h_entrepiso: float  # altura del entrepiso, m
    rigidez: float = 0.0  # rigidez lateral del entrepiso, t/m (opcional, para periodo y distorsión)

@dataclass
class ResultadoEstatico:
    T: float
    c_diseno: float
    Vbase: float
    fuerzas: list = field(default_factory=list)   # (nivel, Fi, Vi)
    distorsiones: list = field(default_factory=list)  # (nivel, desplazamiento cm, distorsión, límite, cumple)

def metodo_estatico(niveles, espectro, T=None, sistema="marco_concreto", limite=None):
    """Método estático: Fi = Wi·hi/ΣWj·hj · (a/Q'R)·ΣW. Válido para estructuras regulares de altura
    moderada (revisar límites de la norma). Si hay rigideces, calcula periodo de Rayleigh y distorsiones."""
    W = sum(n.peso for n in niveles)
    Wh = sum(n.peso * n.altura for n in niveles)
    if T is None:
        T = periodo_empirico(max(n.altura for n in niveles), sistema)
    for _ in range(3):  # iteración con Rayleigh si hay rigideces
        c = espectro.diseno(T)
        V = c * W
        F = [n.peso * n.altura / Wh * V for n in niveles]
        cortantes, acum = [], 0.0
        for f in reversed(F):
            acum += f
            cortantes.append(acum)
        cortantes = list(reversed(cortantes))
        if all(n.rigidez > 0 for n in niveles):
            # niveles ordenados de abajo hacia arriba
            despl, x = [], 0.0
            for n, Vi in zip(niveles, cortantes):
                x += Vi / n.rigidez
                despl.append(x)
            num = sum(n.peso * d ** 2 for n, d in zip(niveles, despl))
            den = sum(f * d for f, d in zip(F, despl))
            T_new = 2 * pi * sqrt(num / (G * den)) if den > 0 else T
            if abs(T_new - T) < 1e-3:
                T = T_new
                break
            T = T_new
        else:
            break
    res = ResultadoEstatico(T=T, c_diseno=c, Vbase=V,
                            fuerzas=[(n.nombre, f, v) for n, f, v in zip(niveles, F, cortantes)])
    if all(n.rigidez > 0 for n in niveles):
        amp = espectro.Qp(T) * espectro.R(T)
        for n, Vi in zip(niveles, cortantes):
            d_el = Vi / n.rigidez * amp  # m
            gamma = d_el / n.h_entrepiso
            res.distorsiones.append((n.nombre, d_el * 100, gamma, limite,
                                     None if limite is None else gamma <= limite))
    return res

def rigidez_columna(E, I, h, empotrada_ambos=True):
    """Rigidez lateral de una columna: 12EI/h³ (doble empotramiento) o 3EI/h³ (empotrada-articulada)."""
    return (12 if empotrada_ambos else 3) * E * I / h ** 3
