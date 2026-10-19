"""Tablas de materiales. Unidades: kgf, cm, kg/cm²."""
from dataclasses import dataclass
from math import sqrt, pi

# Varilla corrugada NMX-B-506 / ASTM A615 (designación en octavos de pulgada)
VARILLAS = {
    # num: (diámetro cm, área cm², peso kg/m, pulgadas)
    2.5: (0.794, 0.49, 0.384, '5/16"'),
    3: (0.953, 0.71, 0.557, '3/8"'),
    4: (1.270, 1.27, 0.996, '1/2"'),
    5: (1.588, 1.98, 1.560, '5/8"'),
    6: (1.905, 2.85, 2.250, '3/4"'),
    8: (2.540, 5.07, 3.975, '1"'),
    10: (3.175, 7.92, 6.225, '1 1/4"'),
    12: (3.810, 11.40, 8.938, '1 1/2"'),
}

def varilla(num):
    d, a, w, pulg = VARILLAS[num]
    return {"num": num, "diam": d, "area": a, "peso": w, "pulg": pulg}

def area(num, n=1):
    return VARILLAS[num][1] * n

def peso_kg_m(num):
    return VARILLAS[num][2]

@dataclass
class Concreto:
    fc: float = 250.0          # f'c kg/cm²
    peso_vol: float = 2400.0   # kg/m³
    agregado: str = "basáltico/calizo"

    @property
    def Ec(self):
        """Módulo de elasticidad ACI 318-19 19.2.2.1 (concreto de peso normal): 15100·√f'c kg/cm²."""
        return 15100 * sqrt(self.fc)

    @property
    def beta1(self):
        """ACI 318-19 Tabla 22.2.2.4.3, convertida a kg/cm²."""
        if self.fc <= 280:
            return 0.85
        return max(0.65, 0.85 - 0.05 * (self.fc - 280) / 70)

    @property
    def fr(self):
        """Módulo de ruptura 2·√f'c kg/cm² (ACI 19.2.3.1: 0.62√f'c MPa)."""
        return 2.0 * sqrt(self.fc)

@dataclass
class Acero:
    fy: float = 4200.0     # kg/cm² grado 42
    Es: float = 2.04e6     # kg/cm² (200,000 MPa)

    @property
    def ey(self):
        return self.fy / self.Es

PESOS_VOLUMETRICOS = {  # kg/m³, valores usuales (NTC Criterios y Acciones, tabla de pesos)
    "concreto_reforzado": 2400, "concreto_simple": 2200, "mortero_cemento_arena": 2100,
    "block_hueco_concreto": 1500, "tabique_rojo": 1500, "yeso": 1500, "loseta_ceramica": 2200,
    "relleno_tepetate": 1600, "suelo_compactado": 1800,
}
