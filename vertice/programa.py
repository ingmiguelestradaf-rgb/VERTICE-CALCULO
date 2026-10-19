"""Programa de obra (ruta crítica), flujo de caja, curva S y evaluación financiera.

Tiempo en días hábiles de obra; la semana de obra es de 6 días (lunes a sábado) por omisión.
"""
from dataclasses import dataclass, field
from math import ceil

@dataclass
class Actividad:
    id: str
    nombre: str
    duracion: float                 # días hábiles
    predecesoras: list = field(default_factory=list)  # ids (fin-inicio)
    costo: float = 0.0              # costo directo + indirecto asignado (sin IVA)
    partida: str = ""
    # resultados CPM
    IC: float = 0; TC: float = 0; IL: float = 0; TL: float = 0

    @property
    def holgura(self):
        return self.IL - self.IC

    @property
    def critica(self):
        return abs(self.holgura) < 1e-6

def duracion_por_rendimiento(cantidad, rendimiento, cuadrillas=1):
    """Días = cantidad / (rendimiento por jornada × número de cuadrillas), redondeado a medio día."""
    return ceil(cantidad / (rendimiento * cuadrillas) * 2) / 2

class Programa:
    def __init__(self, nombre, dias_semana=6):
        self.nombre = nombre
        self.acts = {}
        self.dias_semana = dias_semana

    def agregar(self, *args, **kw):
        a = Actividad(*args, **kw)
        self.acts[a.id] = a
        return a

    def _orden(self):
        orden, vis, temp = [], set(), set()
        def visita(k):
            if k in vis: return
            if k in temp: raise ValueError(f"Ciclo en predecesoras en {k}")
            temp.add(k)
            for p in self.acts[k].predecesoras:
                if p not in self.acts: raise KeyError(f"{k}: predecesora {p} no existe")
                visita(p)
            temp.discard(k); vis.add(k); orden.append(k)
        for k in self.acts: visita(k)
        return orden

    def calcular(self):
        orden = self._orden()
        for k in orden:
            a = self.acts[k]
            a.IC = max((self.acts[p].TC for p in a.predecesoras), default=0)
            a.TC = a.IC + a.duracion
        fin = max(a.TC for a in self.acts.values())
        sucesoras = {k: [] for k in self.acts}
        for a in self.acts.values():
            for p in a.predecesoras: sucesoras[p].append(a.id)
        for k in reversed(orden):
            a = self.acts[k]
            a.TL = min((self.acts[s].IL for s in sucesoras[k]), default=fin)
            a.IL = a.TL - a.duracion
        self.duracion_total = fin
        return fin

    @property
    def ruta_critica(self):
        return [a for a in sorted(self.acts.values(), key=lambda x: x.IC) if a.critica]

    @property
    def semanas(self):
        return ceil(self.duracion_total / self.dias_semana)

    def costo_por_semana(self):
        """Distribuye el costo de cada actividad uniformemente en su duración (inicio temprano)."""
        n = self.semanas
        sem = [0.0] * n
        for a in self.acts.values():
            if a.duracion == 0:
                sem[min(int(a.IC // self.dias_semana), n - 1)] += a.costo; continue
            rate = a.costo / a.duracion
            t = a.IC
            while t < a.TC - 1e-9:
                w = int(t // self.dias_semana)
                fin_sem = (w + 1) * self.dias_semana
                tramo = min(fin_sem, a.TC) - t
                sem[min(w, n - 1)] += rate * tramo
                t += tramo
        return sem

    def gantt_png(self, ruta, titulo=None):
        import matplotlib; matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        acts = sorted(self.acts.values(), key=lambda a: (a.IC, a.id))
        fig, ax = plt.subplots(figsize=(13, 0.38 * len(acts) + 1.6))
        for i, a in enumerate(acts):
            ax.barh(i, a.duracion, left=a.IC, color="#b23b2e" if a.critica else "#1f5f8b", height=0.6)
            if a.holgura > 0:
                ax.barh(i, a.holgura, left=a.TC, color="#cdd2d6", height=0.25)
        ax.set_yticks(range(len(acts)))
        ax.set_yticklabels([f"{a.id}  {a.nombre}" for a in acts], fontsize=8)
        ax.invert_yaxis()
        ax.set_xlabel(f"Días hábiles ({self.dias_semana} por semana)")
        for w in range(self.semanas + 1):
            ax.axvline(w * self.dias_semana, color="#eef0f1", lw=0.6, zorder=0)
        ax.set_title(titulo or f"Programa de obra — {self.nombre}  ·  {self.duracion_total:g} días hábiles  ·  rojo = ruta crítica", fontsize=10, loc="left")
        for s in ("top", "right"): ax.spines[s].set_visible(False)
        fig.tight_layout(); fig.savefig(ruta, dpi=150); plt.close(fig)
        return ruta

@dataclass
class EsquemaPago:
    anticipo: float = 0.30        # fracción del contrato al inicio
    periodo_estimacion: int = 2   # semanas entre estimaciones
    dias_pago: int = 2            # semanas que tarda el cliente en pagar una estimación
    retencion: float = 0.05       # fondo de garantía retenido por estimación
    iva: float = 0.08

@dataclass
class EsquemaEgresos:
    """Cómo se paga lo que la obra consume."""
    fraccion_material: float = 0.55   # del costo, cuánto es material
    credito_material_sem: int = 2     # semanas de crédito de proveedor
    fraccion_mo: float = 0.35         # nómina: se paga la misma semana
    # el resto (subcontratos/indirectos) se paga con 1 semana de desfase

def flujo_de_caja(programa, monto_contrato, costo_total=None, pago=EsquemaPago(), egresos=EsquemaEgresos(), tasa_anual=0.14):
    """Flujo semanal sin IVA (el IVA se traslada y acredita; se reporta aparte).
    Regresa lista de dicts por semana con ingresos, egresos, saldo y acumulado, y un resumen."""
    costo_sem = programa.costo_por_semana()
    if costo_total:
        k = costo_total / sum(costo_sem)
        costo_sem = [c * k for c in costo_sem]
    n = len(costo_sem)
    horizonte = n + max(pago.dias_pago, egresos.credito_material_sem) + pago.periodo_estimacion + 2
    ing = [0.0] * horizonte; egr = [0.0] * horizonte
    ing[0] += monto_contrato * pago.anticipo
    avance = [c / sum(costo_sem) for c in costo_sem]
    acumulado_est = 0.0
    for w in range(n):
        f_mat, f_mo = egresos.fraccion_material, egresos.fraccion_mo
        egr[min(w + egresos.credito_material_sem, horizonte - 1)] += costo_sem[w] * f_mat
        egr[w] += costo_sem[w] * f_mo
        egr[min(w + 1, horizonte - 1)] += costo_sem[w] * (1 - f_mat - f_mo)
        if (w + 1) % pago.periodo_estimacion == 0 or w == n - 1:
            ini = w + 1 - pago.periodo_estimacion if (w + 1) % pago.periodo_estimacion == 0 else (w // pago.periodo_estimacion) * pago.periodo_estimacion
            est = monto_contrato * sum(avance[max(ini, 0):w + 1])
            acumulado_est += est
            neto = est * (1 - pago.anticipo - pago.retencion)
            ing[min(w + 1 + pago.dias_pago, horizonte - 1)] += neto
    ing[min(n + pago.dias_pago + 2, horizonte - 1)] += monto_contrato * pago.retencion  # devolución del fondo de garantía
    filas, acum, minimo = [], 0.0, 0.0
    for w in range(horizonte):
        acum += ing[w] - egr[w]
        minimo = min(minimo, acum)
        filas.append({"semana": w + 1, "ingresos": ing[w], "egresos": egr[w], "saldo": ing[w] - egr[w], "acumulado": acum,
                      "costo_programado": costo_sem[w] if w < n else 0.0})
    i_sem = (1 + tasa_anual) ** (1 / 52) - 1
    costo_fin = sum(max(0, -f["acumulado"]) * i_sem for f in filas)
    return filas, {"necesidad_max_financiamiento": -minimo, "costo_financiamiento": costo_fin,
                   "pct_financiamiento_sobre_costo": costo_fin / sum(costo_sem) * 100,
                   "utilidad_bruta": acum, "semanas_obra": n}

def curva_s(programa):
    sem = programa.costo_por_semana()
    tot = sum(sem); acc = 0; out = []
    for i, c in enumerate(sem, 1):
        acc += c; out.append((i, acc, acc / tot))
    return out

def vpn(tasa, flujos):
    """VPN con tasa por periodo; flujos[0] en t=0."""
    return sum(f / (1 + tasa) ** t for t, f in enumerate(flujos))

def tir(flujos, lo=-0.99, hi=10.0, tol=1e-7):
    f_lo, f_hi = vpn(lo, flujos), vpn(hi, flujos)
    if f_lo * f_hi > 0:
        return None
    for _ in range(300):
        mid = (lo + hi) / 2
        f = vpn(mid, flujos)
        if abs(f) < tol: break
        if f_lo * f < 0: hi, f_hi = mid, f
        else: lo, f_lo = mid, f
    return mid

def periodo_recuperacion(flujos):
    acc = 0
    for t, f in enumerate(flujos):
        prev = acc; acc += f
        if acc >= 0 and t > 0:
            return t - 1 + (-prev / f if f else 0)
    return None

def grafica_flujo_png(filas, ruta, titulo="Flujo de caja semanal"):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    s = [f["semana"] for f in filas]
    fig, ax = plt.subplots(figsize=(12, 4.6))
    ax.bar(s, [f["ingresos"] / 1e3 for f in filas], color="#2e7d4f", label="Ingresos")
    ax.bar(s, [-f["egresos"] / 1e3 for f in filas], color="#b23b2e", label="Egresos")
    ax.plot(s, [f["acumulado"] / 1e3 for f in filas], color="#1d2328", lw=2, label="Saldo acumulado")
    ax.axhline(0, color="#5b656e", lw=0.8)
    ax.set_xlabel("Semana"); ax.set_ylabel("Miles de pesos (sin IVA)")
    ax.set_title(titulo, loc="left", fontsize=11); ax.legend(frameon=False, ncol=3, loc="upper left")
    for sp in ("top", "right"): ax.spines[sp].set_visible(False)
    fig.tight_layout(); fig.savefig(ruta, dpi=150); plt.close(fig)
    return ruta

def curva_s_png(programa, ruta):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    cs = curva_s(programa)
    fig, ax = plt.subplots(figsize=(8, 4.4))
    ax.plot([0] + [c[0] for c in cs], [0] + [c[2] * 100 for c in cs], color="#1f5f8b", lw=2.2)
    ax.set_xlabel("Semana"); ax.set_ylabel("% de costo acumulado programado"); ax.set_ylim(0, 102)
    ax.set_title(f"Curva S planeada — {programa.nombre}", loc="left", fontsize=11)
    ax.grid(axis="y", color="#e3e6e8")
    for sp in ("top", "right"): ax.spines[sp].set_visible(False)
    fig.tight_layout(); fig.savefig(ruta, dpi=150); plt.close(fig)
    return ruta

def programa_a_excel(programa, filas_flujo, resumen_flujo, ruta):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.chart import LineChart, Reference
    wb = Workbook(); H = Font(bold=True, color="FFFFFF"); F = PatternFill("solid", fgColor="1D2328")
    money = '"$"#,##0'
    ws = wb.active; ws.title = "Programa"
    cols = ["ID", "Actividad", "Partida", "Duración (días)", "Predecesoras", "Inicio temprano", "Fin temprano",
            "Inicio tardío", "Fin tardío", "Holgura", "Crítica", "Costo"]
    for j, c in enumerate(cols, 1):
        x = ws.cell(1, j, c); x.font = H; x.fill = F
    for i, a in enumerate(sorted(programa.acts.values(), key=lambda a: (a.IC, a.id)), 2):
        vals = [a.id, a.nombre, a.partida, a.duracion, ", ".join(a.predecesoras), a.IC, a.TC, a.IL, a.TL,
                f"=H{i}-F{i}", "Sí" if a.critica else "", a.costo]
        for j, v in enumerate(vals, 1):
            ws.cell(i, j, v)
        ws.cell(i, 12).number_format = money
        # barra semanal
        for w in range(programa.semanas):
            d0, d1 = w * programa.dias_semana, (w + 1) * programa.dias_semana
            if a.IC < d1 and a.TC > d0:
                ws.cell(i, 14 + w).fill = PatternFill("solid", fgColor="B23B2E" if a.critica else "1F5F8B")
    for w in range(programa.semanas):
        x = ws.cell(1, 14 + w, f"S{w+1}"); x.font = H; x.fill = F
        ws.column_dimensions[ws.cell(1, 14 + w).column_letter].width = 4
    ws.column_dimensions["B"].width = 44; ws.freeze_panes = "C2"
    fl = wb.create_sheet("Flujo de caja")
    hdr = ["Semana", "Costo programado", "Ingresos", "Egresos", "Saldo", "Acumulado"]
    for j, c in enumerate(hdr, 1):
        x = fl.cell(1, j, c); x.font = H; x.fill = F
    for i, f in enumerate(filas_flujo, 2):
        fl.cell(i, 1, f["semana"]); fl.cell(i, 2, round(f["costo_programado"], 2)); fl.cell(i, 3, round(f["ingresos"], 2))
        fl.cell(i, 4, round(f["egresos"], 2)); fl.cell(i, 5, f"=C{i}-D{i}"); fl.cell(i, 6, f"=E{i}" if i == 2 else f"=F{i-1}+E{i}")
        for j in range(2, 7): fl.cell(i, j).number_format = money
    last = len(filas_flujo) + 1
    r = last + 2
    for k, v in resumen_flujo.items():
        fl.cell(r, 1, k.replace("_", " ")); fl.cell(r, 2, round(v, 2)); r += 1
    ch = LineChart(); ch.title = "Saldo acumulado"; ch.height = 7; ch.width = 18
    ch.add_data(Reference(fl, min_col=6, min_row=1, max_row=last), titles_from_data=True)
    ch.set_categories(Reference(fl, min_col=1, min_row=2, max_row=last))
    fl.add_chart(ch, "H2")
    for c, w in zip("ABCDEF", (9, 17, 15, 15, 15, 16)): fl.column_dimensions[c].width = w
    cs = wb.create_sheet("Curva S")
    for j, c in enumerate(["Semana", "Costo acumulado", "% acumulado"], 1):
        x = cs.cell(1, j, c); x.font = H; x.fill = F
    for i, (w, acc, pct) in enumerate(curva_s(programa), 2):
        cs.cell(i, 1, w); cs.cell(i, 2, round(acc, 2)).number_format = money; cs.cell(i, 3, pct).number_format = "0.0%"
    wb.save(ruta)
    return ruta
