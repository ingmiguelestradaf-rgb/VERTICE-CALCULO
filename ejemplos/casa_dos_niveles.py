"""Ejemplo completo: casa habitación de 2 niveles en Tijuana (8 × 10 m, 160 m²).

Muros de block confinado, losas macizas, trabes y columnas en el claro de la sala, zapatas aisladas bajo columnas
y zapatas corridas bajo muros. Genera en ejemplos/salida/:
  memoria_calculo.docx, E-01_cimentacion.dxf/.pdf, E-02_trabes_columnas.dxf/.pdf,
  presupuesto.xlsx, programa_flujo.xlsx, gantt.png, flujo.png, curva_s.png

Uso:  python ejemplos/casa_dos_niveles.py
Los valores marcados como SUPUESTO deben sustituirse por los datos reales del proyecto (EMS, PRODISIS, etc.).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from vertice import concreto as C, cimentacion as Z, mamposteria as M, sismo as S, cargas as K
from vertice import costos, programa as P, dibujo as D
from vertice.memoria import Documento, NORMATIVA_BC
from vertice.materiales import Concreto, Acero

OUT = os.path.join(os.path.dirname(__file__), "salida"); os.makedirs(OUT, exist_ok=True)
PROY = "Casa habitación 2 niveles — ejemplo"
fc, fy = 250, 4200
conc, acero = Concreto(fc), Acero(fy)

# ---------------- 1. cargas ----------------
ent, azo = K.entrepiso_tipico(0.12), K.azotea_tipica(0.12)
cv_ent, cv_azo = K.CARGAS_VIVAS["habitacion"], K.CARGAS_VIVAS["azotea_pendiente_hasta_5pct"]
w_ent = K.combinaciones_ntc(ent.carga_muerta, cv_ent[0], cv_ent[1])["envolvente"]
w_azo = K.combinaciones_ntc(azo.carga_muerta, cv_azo[0], cv_azo[1])["envolvente"]
area_planta = 8 * 10
muros_kg_m2 = 1500 * 0.15 * 2.5 * 2 * (8 + 10) * 1.3 / area_planta  # block 15 cm, muros perimetrales + interiores ≈ 1.3×
W1 = (ent.carga_muerta + cv_ent[1] + muros_kg_m2) * area_planta / 1000   # t
W2 = (azo.carga_muerta + cv_azo[1] + muros_kg_m2 / 2) * area_planta / 1000

# ---------------- 2. sismo ----------------
# SUPUESTO: parámetros de forma espectral tipo PRODISIS para terreno tipo II en Tijuana. Sustituir por la salida real.
esp = S.Espectro.cfe_parametrico(a0=0.22, c=0.60, Ta=0.10, Tb=0.60, k=1.5, r=0.5, Q=1.5, R0=2.0)
niveles = [S.Nivel("Entrepiso", W1, 2.8, 2.8), S.Nivel("Azotea", W2, 5.6, 2.8)]
sis = S.metodo_estatico(niveles, esp, sistema="mamposteria")
cs = sis.c_diseno

# ---------------- 3. mampostería ----------------
vm = M.VM_TIPICOS["block_concreto_hueco_mortero_I"]  # SUPUESTO
muros = [M.Muro("A", "X", 800, 15, 260, 9000), M.Muro("C", "X", 800, 15, 260, 9000), M.Muro("B", "X", 400, 15, 260, 6000),
         M.Muro("1", "Y", 1000, 15, 260, 11000), M.Muro("3", "Y", 1000, 15, 260, 11000), M.Muro("2", "Y", 500, 15, 260, 6000)]
mres = M.metodo_simplificado(muros, (W1 + W2) * 1000, cs, vm)

# ---------------- 4. losa, trabe, columna ----------------
h_losa = C.espesor_min_losa_perimetral(500, 400, fy)
L_trabe = 500
wu_trabe = w_azo * 4.0 / 1000 + 0.25 * 0.5 * 2.4 * 1.3  # t/m (ancho tributario 4 m + peso propio)
Mu_t = wu_trabe * (L_trabe / 100) ** 2 / 10   # t·m, continuidad parcial (coef. 1/10)
Vu_t = wu_trabe * (L_trabe / 100) / 2 * 1.15
b_t, h_t = 25, 50; d_t = h_t - 6
fl_t = C.flexion_rectangular(C.tm_a_kgcm(Mu_t), b_t, d_t, conc, acero)
var_t = C.proponer_varillas(fl_t.As_diseno, b=b_t)
co_t = C.cortante_viga(Vu_t * 1000, b_t, d_t)
Pu_c = (w_azo + w_ent) * 4 * 5 / 1000  # t, área tributaria 20 m² por nivel
Mu_c = 0.05 * Pu_c * 0.30 + 1.0         # excentricidad accidental + flexión por sismo SUPUESTA (t·m)
capas = C.capas_rectangular(30, 30, num_esq=6)
rc = C.revisar_columna(Pu_c * 1000, C.tm_a_kgcm(Mu_c), 30, 30, capas)
s_est_col = C.estribos_columna(30, 30, 6, 3)

# ---------------- 5. cimentación ----------------
q_adm = 12.0  # t/m² SUPUESTO sin EMS
P_serv_c = Pu_c / 1.4
zap = Z.zapata_aislada(P_serv_c, Pu_c, 30, 30, q_adm, Df=1.2)
w_muro_serv = ((azo.carga_muerta + cv_azo[0]) * 2.5 + (ent.carga_muerta + cv_ent[0]) * 2.5) / 1000 + 1500 * 0.15 * 5.2 / 1000
zc = Z.zapata_corrida(w_muro_serv, w_muro_serv * 1.4, 15, q_adm, Df=1.0)

# ---------------- 6. memoria ----------------
doc = Documento("Casa habitación de dos niveles", PROY, cliente="(ejemplo)")
doc.seccion("Supuestos a validar")
doc.supuestos([("Capacidad de carga del terreno (sin EMS)", f"{q_adm} t/m²", "Cambia dimensiones de zapatas"),
               ("Espectro sísmico (parámetros tipo PRODISIS)", "a0=0.22, c=0.60, Ta=0.1, Tb=0.6", "Cambia cortante basal y revisión de muros"),
               ("Resistencia v*m del block", f"{vm} kg/cm²", "Cambia capacidad a cortante de muros"),
               ("Flexión de columna por sismo", f"{Mu_c:.2f} t·m", "Revisar con análisis de marco")])
doc.seccion("1. Datos generales y normativa aplicada")
doc.tabla(["Norma", "Ámbito"], NORMATIVA_BC)
doc.parrafo("Grupo B (habitación). Estructuración: muros de carga de block de concreto confinados con castillos y dalas, "
            "losas macizas de concreto, marco de trabes y columnas en el claro de sala.")
doc.seccion("3. Materiales")
doc.tabla(["Material", "Valor"], [("Concreto estructural f'c", f"{fc} kg/cm²"), ("Módulo Ec", f"{conc.Ec:,.0f} kg/cm²"),
                                  ("Acero fy", f"{fy} kg/cm²"), ("Block v*m", f"{vm} kg/cm²")])
doc.seccion("4. Análisis de cargas")
for sist, cv in ((ent, cv_ent), (azo, cv_azo)):
    doc.parrafo(sist.nombre, True)
    doc.tabla(["Capa", "Espesor (m)", "Peso vol. (kg/m³)", "kg/m²"], sist.desglose())
    doc.parrafo(f"CM = {sist.carga_muerta:.0f} kg/m² · CV máx = {cv[0]} · CV inst = {cv[1]} kg/m²")
doc.formula(f"w entrepiso = 1.3CM + 1.5CV = {w_ent:.0f} kg/m²; w azotea = {w_azo:.0f} kg/m²", "NTC Criterios y Acciones")
doc.seccion("5. Análisis sísmico")
doc.formula(f"T = {sis.T:.3f} s · c/(Q'R) = {cs:.4f} · Vbase = {sis.Vbase:.2f} t", "MDOC-CFE Sismo, método estático")
doc.tabla(["Nivel", "Fi (t)", "Vi (t)"], [(n, f, v) for n, f, v in sis.fuerzas])
doc.seccion("Revisión de muros (método simplificado)", 2)
doc.tabla(["Dirección", "Vu (kg)", "ΣFAE·VmR (kg)", "Resultado"], [(r.direccion, r.Vu, r.VR, r.cumple) for r in mres])
doc.seccion("6. Diseño de elementos")
doc.formula(f"Losa perimetral 4×5 m: h mín = {h_losa:.1f} cm → se usa 12 cm", "ACI 318-19 Tabla 8.3.1.2")
doc.parrafo("Trabe T-1 (25×50, claro 5 m)", True)
doc.formula(f"Mu = {Mu_t:.2f} t·m → As req = {fl_t.As_req:.2f} cm², As min = {fl_t.As_min:.2f} cm² → {var_t['texto']}", "ACI 9.5, 9.6, 22.2")
doc.formula(f"Vu = {Vu_t:.2f} t, φVc = {co_t.phiVc/1000:.2f} t → E#3 @ {co_t.s_diseno:g} cm", "ACI 22.5, 9.7.6")
doc.parrafo("Columna C-1 (30×30, 4#6)", True)
doc.formula(f"Pu = {Pu_c:.2f} t, Mu = {Mu_c:.2f} t·m, φMn = {rc['phiMn']/1e5:.2f} t·m, D/C = {rc['DC']:.2f}, ρ = {rc['rho']:.2%}", "ACI 22.4, 10.6")
doc.seccion("7. Diseño de cimentación")
doc.tabla(["Elemento", "Dimensiones", "q servicio (t/m²)", "Armado", "Resultado"],
          [("Z-1", f"{zap.B:g}×{zap.L:g}×{zap.h:g} cm", zap.q_serv, zap.armado, zap.cumple),
           ("ZC-1", f"B = {zc['B']:g} cm, h = {zc['h']:g} cm", round(zc["q_serv"], 2), zc["armado"], zc["cumple"])])
doc.seccion("9. Responsiva"); doc.responsiva()
doc.guardar(os.path.join(OUT, "memoria_calculo.docx"))

# ---------------- 7. planos ----------------
notas = D.NOTAS_ESTRUCTURALES + [f"q adm supuesta = {q_adm} t/m² (validar con EMS)."]
h1 = D.hoja(D.DatosPlano(PROY, contenido="Planta de cimentación y detalles", clave="E-01", notas=notas))
v = D.planta_ejes(h1, 95, 150, 40, [0, 400, 800], [0, 500, 1000])
B = zc["B"]
for y in (0, 500, 1000):   # zapatas corridas en ejes A, B, C
    v.rect(-B / 2, y - B / 2, 800 + B, B, "CONCRETO"); v.rect(0, y - 7.5, 800, 15, "MUROS")
for x in (0, 400, 800):    # zapatas corridas en ejes 1, 2, 3
    v.rect(x - B / 2, -B / 2, B, 1000 + B, "CONCRETO"); v.rect(x - 7.5, 0, 15, 1000, "MUROS")
v.rect(400 - zap.B / 2, 500 - zap.L / 2, zap.B, zap.L, "CONCRETO"); v.rect(400 - 15, 500 - 15, 30, 30)
px, py = v.p(400 + zap.B / 2, 500 + zap.L / 2); h1.texto((px + 2, py + 2), "Z-1 / C-1", 3)
px, py = v.p(200, 0 + B / 2); h1.texto((px, py + 3), "ZC-1", 3, alin="centro")
px, py = v.p(0 + B / 2, 250); h1.texto((px + 3, py), "ZC-1", 3)
v.titulo(400, -260, "PLANTA DE CIMENTACIÓN")
D.detalle_zapata(h1, 400, 410, 20, "Z-1", zap.B, zap.L, zap.h, 30, 30, zap.armado)
D.tabla(h1, 400, 330, ["Elemento", "Dimensiones (cm)", "Armado", "f'c"],
        [["Z-1", f"{zap.B:g} × {zap.L:g} × {zap.h:g}", zap.armado, "250"],
         ["ZC-1", f"B = {zc['B']:g}, h = {zc['h']:g}", zc["armado"], "250"],
         ["C-1", "30 × 30", f"4#6, E#3 @ {s_est_col} (@ 10 en 50 cm extremos)", "250"]],
        [22, 40, 108, 14], titulo="CUADRO DE CIMENTACIÓN")
D.tabla(h1, 400, 265, ["Varilla", "ld (cm)", "Traslape (cm)", "Gancho (cm)"],
        [[f"#{n}", f"{C.longitud_desarrollo(n):.0f}", f"{C.traslape(n):.0f}", f"{C.gancho_estandar(n):.0f}"] for n in (3, 4, 5, 6)],
        [25, 25, 30, 30], titulo="LONGITUDES DE DESARROLLO (f'c 250, fy 4200)")
h1.guardar_dxf(os.path.join(OUT, "E-01_cimentacion.dxf")); h1.guardar_pdf(os.path.join(OUT, "E-01_cimentacion.pdf"))
h1.guardar_png(os.path.join(OUT, "E-01_cimentacion.png"))

h2 = D.hoja(D.DatosPlano(PROY, contenido="Trabes, columnas y losas", clave="E-02", notas=D.NOTAS_ESTRUCTURALES))
n_inf, num = var_t["n"], var_t["num"]
D.seccion_rectangular(h2, 70, 400, 5, "T-1 SECCIÓN", b_t, h_t, 4, [(2, num)], [(n_inf, num)], 3, f"@ {co_t.s_diseno:g}")
D.elevacion_trabe(h2, 90, 230, 20, "T-1 ELEVACIÓN", L_trabe, h_t, 30, [(2, num)], [(n_inf, num)], 3, 10, min(co_t.s_diseno, 20))
D.seccion_rectangular(h2, 260, 420, 5, "C-1 SECCIÓN", 30, 30, 4, [(2, 6)], [(2, 6)], 3, f"@ {s_est_col} (@10 en extremos)")
D.tabla(h2, 70, 120, ["Losa", "Espesor", "Armado lecho inferior", "Bastones lecho superior"],
        [["L-1 (4 × 5 m)", "12 cm", "#3 @ 20 cm ambos sentidos", "#3 @ 40 cm, L/4 desde apoyos"]],
        [40, 22, 70, 80], titulo="CUADRO DE LOSAS")
h2.guardar_dxf(os.path.join(OUT, "E-02_trabes_columnas.dxf")); h2.guardar_pdf(os.path.join(OUT, "E-02_trabes_columnas.pdf"))
h2.guardar_png(os.path.join(OUT, "E-02_trabes_columnas.png"))

# ---------------- 8. presupuesto ----------------
db = costos.BaseDatos()
area = 160
cant = {  # cuantificación simplificada del ejemplo
    "exc-mano": 2 * (8 + 10 + 18) * 0.6 * 1.0 + zap.B * zap.L / 1e4 * 1.2,
    "plantilla": 2 * (8 + 10 + 18) * 0.6 / 2,
    "cimbra-cim": 2 * (8 + 10 + 18) * 0.6,
    "acero-ligero": 2200, "acero-medio": 900,
    "colado-bomba": 2 * (8 + 10 + 18) * 0.6 * 0.25 / 2 + 2 * 80 * 0.12 + 1.2,
    "cimbra-losa": 160, "cimbra-col": 2 * 4 * 0.3 * 2.8, "cimbra-trabe": 5 * 1.25 * 2,
    "block-15": 2 * 2.6 * (2 * (8 + 10) + 18) * 0.85,
    "castillo": 2 * 2.6 * 24, "dala": 2 * (2 * (8 + 10) + 18),
    "firme": 80, "aplanado": 2 * 2.6 * (2 * (8 + 10) + 18) * 0.85 * 1.5,
    "piso-cer": 150, "pintura": 2 * 2.6 * (2 * (8 + 10) + 18) * 0.85 * 2 + 160, "imper": 85,
    "salida-elec": 70, "salida-hid": 18,
}
pres = costos.Presupuesto(PROY, cliente="(ejemplo)", area_construida=area)
for i, (rid, q) in enumerate(cant.items(), 1):
    pres.agregar(costos.apu_desde_base(db, rid, clave=f"{i:03d}"), round(q, 2))
pres.a_excel(os.path.join(OUT, "presupuesto.xlsx"))

# ---------------- 9. programa y flujo ----------------
pr = P.Programa(PROY)
def act(i, nombre, rid, pred, cuadrillas=1, extra_dias=0):
    r = db.rendimiento(rid); q = cant[rid]
    dur = P.duracion_por_rendimiento(q, (r["rend_min"] + r["rend_max"]) / 2, cuadrillas) + extra_dias
    costo = sum(pres.pu(c) * c.cantidad for c in pres.conceptos if c.apu.clave == f"{list(cant).index(rid)+1:03d}")
    return pr.agregar(i, nombre, dur, pred, costo=costo, partida=r["partida"])
act("A01", "Excavación de cimentación", "exc-mano", [], 3)
act("A02", "Plantillas", "plantilla", ["A01"])
act("A03", "Cimbra de cimentación", "cimbra-cim", ["A02"])
act("A04", "Acero de cimentación y columnas", "acero-medio", ["A02"])
act("A05", "Muros de block (dos niveles)", "block-15", ["A03", "A04"], 3)
act("A06", "Castillos", "castillo", ["A05"], 2)
act("A07", "Dalas", "dala", ["A06"], 2)
act("A08", "Cimbra de losas, trabes y columnas", "cimbra-losa", ["A07"], 2)
act("A09", "Acero de losas", "acero-ligero", ["A08"], 2)
act("A10", "Colados (cimentación y losas)", "colado-bomba", ["A09"], 1, 2)
act("A11", "Instalación eléctrica", "salida-elec", ["A07"], 1)
act("A12", "Instalación hidrosanitaria", "salida-hid", ["A07"], 1)
act("A13", "Firmes", "firme", ["A10", "A12"])
act("A14", "Aplanados", "aplanado", ["A11", "A12", "A10"], 3)
act("A15", "Impermeabilización", "imper", ["A10"])
act("A16", "Pisos cerámicos", "piso-cer", ["A13", "A14"], 2)
act("A17", "Pintura", "pintura", ["A16"], 2)
pr.calcular()
# reparte el resto del presupuesto (conceptos sin actividad propia) proporcionalmente
resto = pres.subtotal - sum(a.costo for a in pr.acts.values())
tot = sum(a.costo for a in pr.acts.values())
for a in pr.acts.values():
    a.costo += resto * a.costo / tot
filas, res = P.flujo_de_caja(pr, pres.subtotal, pago=P.EsquemaPago(anticipo=0.30, periodo_estimacion=2, dias_pago=1))
pr.gantt_png(os.path.join(OUT, "gantt.png"))
P.grafica_flujo_png(filas, os.path.join(OUT, "flujo.png"))
P.curva_s_png(pr, os.path.join(OUT, "curva_s.png"))
P.programa_a_excel(pr, filas, res, os.path.join(OUT, "programa_flujo.xlsx"))

print(f"Cortante basal {sis.Vbase:.2f} t (c = {cs:.3f}); muros: " + ", ".join(f"{r.direccion} {'OK' if r.cumple else 'NO'}" for r in mres))
print(f"T-1: {var_t['texto']} inf., E#3 @ {co_t.s_diseno:g}; C-1 D/C {rc['DC']:.2f}; Z-1 {zap.B:g}×{zap.L:g}×{zap.h:g}")
print(f"Presupuesto sin IVA ${pres.subtotal:,.0f} (${pres.subtotal/area:,.0f}/m²); con IVA ${pres.total:,.0f}")
print(f"Programa {pr.duracion_total:g} días hábiles ({pr.semanas} semanas); financiamiento máximo ${res['necesidad_max_financiamiento']:,.0f}")
