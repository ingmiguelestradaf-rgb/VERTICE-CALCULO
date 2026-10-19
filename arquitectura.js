/* Vértice Cálculo — planos arquitectónicos, fachada y corte, instalación eléctrica e hidrosanitaria
   a partir de los espacios capturados (rectángulos por nivel). Unidades del modelo: cm. */
"use strict";
(function () {
const K = window.VCD;
const MURO = 15, H2 = MURO / 2;
const TIPO_NOMBRE = { sala: "Sala", comedor: "Comedor", cocina: "Cocina", recamara: "Recámara", bano: "Baño", medio_bano: "Medio baño", lavanderia: "Lavandería", estudio: "Estudio", escalera: "Escalera", pasillo: "Pasillo", cochera: "Cochera", bodega: "Bodega" };
// muebles sanitarios: agua (UM Hunter, tanque) y drenaje (UM descarga, diámetro mínimo)
const MUEBLES = {
  WC: { nom: "Inodoro (tanque)", um: 3, ud: 4, dren: 100, caliente: false, w: 40, d: 70 },
  LAV: { nom: "Lavabo", um: 1, ud: 1, dren: 38, caliente: true, w: 50, d: 40 },
  REG: { nom: "Regadera", um: 2, ud: 2, dren: 50, caliente: true, w: 90, d: 90 },
  FRE: { nom: "Fregadero", um: 2, ud: 2, dren: 50, caliente: true, w: 80, d: 55 },
  LVD: { nom: "Lavadero", um: 2, ud: 2, dren: 50, caliente: false, w: 70, d: 60 },
  LVA: { nom: "Lavadora", um: 2, ud: 3, dren: 50, caliente: true, w: 65, d: 65 },
};
const MUEBLES_TIPO = { bano: ["WC", "LAV", "REG"], medio_bano: ["WC", "LAV"], cocina: ["FRE"], lavanderia: ["LVD", "LVA"] };
// Hunter, muebles con tanque: UM → gasto probable (l/s), referencia
const HUNTER = [[0, 0], [3, 0.20], [6, 0.32], [10, 0.50], [20, 0.88], [30, 1.26], [40, 1.56], [50, 1.83], [60, 2.02], [80, 2.40], [100, 2.74], [150, 3.4], [200, 4.0]];
const hunter = um => { for (let i = 1; i < HUNTER.length; i++) if (um <= HUNTER[i][0]) { const [a, qa] = HUNTER[i - 1], [b, qb] = HUNTER[i]; return qa + (qb - qa) * (um - a) / (b - a); } return 4.0 + (um - 200) * 0.01; };
const DIAM = [13, 19, 25, 32, 38, 50];

function leer() {
  const g = k => val("arq", k);
  const esp = (TD.arq || []).map((r, i) => ({ i, nom: String(r[0] || "Espacio"), tipo: r[1], niv: +r[2] || 1, x: +r[3] || 0, y: +r[4] || 0, w: Math.max(50, +r[5] || 0), l: Math.max(50, +r[6] || 0), pu: r[7], ve: r[8] }));
  return { esp, hn: (g("hn") || 2.8) * 100, esl: g("esl") || 12, pretil: (g("pretil") || 0.9) * 100 };
}
const niveles = esp => [...new Set(esp.map(e => e.niv))].sort((a, b) => a - b);
const ext = es => ({ x0: Math.min(...es.map(e => e.x)), y0: Math.min(...es.map(e => e.y)), x1: Math.max(...es.map(e => e.x + e.w)), y1: Math.max(...es.map(e => e.y + e.l)) });

/* ---------- geometría de muros y vanos ---------- */
// lados: S (y=y, X→), N (y=y+l), O (x=x, Y→), E (x=x+w); dentro = dirección hacia el interior
function lados(e) {
  return {
    S: { o: "h", c: e.y, a: e.x, b: e.x + e.w, dentro: 1 }, N: { o: "h", c: e.y + e.l, a: e.x, b: e.x + e.w, dentro: -1 },
    O: { o: "v", c: e.x, a: e.y, b: e.y + e.l, dentro: 1 }, E: { o: "v", c: e.x + e.w, a: e.y, b: e.y + e.l, dentro: -1 },
  };
}
function vanos(es) {
  const v = [];
  for (const e of es) {
    const L = lados(e);
    if (L[e.pu]) { const s = L[e.pu], dw = /bano/.test(e.tipo) ? 75 : 90, a = Math.min(s.a + 30, s.b - dw - 10); v.push({ tipo: "puerta", o: s.o, c: s.c, a, b: a + dw, dentro: s.dentro, lado: e.pu, e }); }
    if (L[e.ve]) {
      const s = L[e.ve], len = s.b - s.a, ww = /bano/.test(e.tipo) ? 60 : Math.min(150, len * 0.5); let a = (s.a + s.b) / 2 - ww / 2;
      const p = v.find(q => q.e === e && q.tipo === "puerta" && q.lado === e.ve); if (p && a < p.b + 20) a = Math.min(s.b - 30 - ww, p.b + 20);
      if (a > s.a + 10) v.push({ tipo: "ventana", o: s.o, c: s.c, a, b: a + ww, dentro: s.dentro, lado: e.ve, e, sill: /bano/.test(e.tipo) ? 160 : 100, alto: /bano/.test(e.tipo) ? 50 : 120 });
    }
  }
  return v;
}
function restar(segs, cortes) { // segs: [[a,b]], cortes: [[a,b]]
  let out = segs;
  for (const [ca, cb] of cortes) { const n = []; for (const [a, b] of out) { if (cb <= a || ca >= b) { n.push([a, b]); continue; } if (ca > a) n.push([a, ca]); if (cb < b) n.push([cb, b]); } out = n; }
  return out.filter(([a, b]) => b - a > 0.5);
}
// segmentos exteriores de un lado (sin vecino del otro lado)
function exterior(e, s, es) {
  const vec = [];
  for (const q of es) { if (q === e) continue; const Lq = lados(q); for (const t of Object.values(Lq)) if (t.o === s.o && Math.abs(t.c - s.c) < 2 && t.dentro !== s.dentro) vec.push([t.a, t.b]); }
  return restar([[s.a, s.b]], vec);
}
function muros(v, d, es, vs, capa = "MUROS") {
  const P = (o, c, t) => o === "h" ? [t, c] : [c, t];
  const L = (o, c, a, b) => v.linea(P(o, c, a), P(o, c, b), capa);
  for (const e of es) {
    for (const [nm, s] of Object.entries(lados(e))) {
      const ci = s.c + s.dentro * H2, cortes = vs.filter(q => q.o === s.o && Math.abs(q.c - s.c) < 2).map(q => [q.a, q.b]);
      for (const [a, b] of restar([[s.a + H2, s.b - H2]], cortes)) L(s.o, ci, a, b);
      const co = s.c - s.dentro * H2;
      for (const [a, b] of exterior(e, s, es)) {
        const aa = Math.abs(a - s.a) < 1 ? a - H2 : a, bb = Math.abs(b - s.b) < 1 ? b + H2 : b;
        for (const [p, q] of restar([[aa, bb]], cortes)) L(s.o, co, p, q);
      }
    }
  }
  for (const q of vs) { // jambas y símbolos
    for (const t of [q.a, q.b]) v.linea(P(q.o, q.c - H2, t), P(q.o, q.c + H2, t), capa);
    if (q.tipo === "ventana") { for (const dc of [-2.5, 0, 2.5]) v.linea(P(q.o, q.c + dc, q.a), P(q.o, q.c + dc, q.b), "VENTANAS"); }
    else {
      const dw = q.b - q.a, h = P(q.o, q.c, q.a);
      const hoja = q.o === "h" ? [q.a, q.c + q.dentro * dw] : [q.c + q.dentro * dw, q.a];
      v.linea(h, hoja, "PUERTAS");
      const [px, py] = v.p(...h), r = v.l(dw);
      const ang = q.o === "h" ? (q.dentro > 0 ? [0, 90] : [270, 360]) : (q.dentro > 0 ? [0, 90] : [90, 180]);
      d.arco([px, py], r, ang[0], ang[1], "PUERTAS");
    }
  }
}
// posición de muebles junto al muro opuesto a la puerta
function muebles(e) {
  const lista = MUEBLES_TIPO[e.tipo] || [], opuesto = { S: "N", N: "S", E: "O", O: "E" }[e.pu] || "N", out = [];
  let t = 25;
  for (const k of lista) {
    const m = MUEBLES[k]; let x, y, w = m.w, d = m.d;
    if (opuesto === "N") { x = e.x + H2 + t; y = e.y + e.l - H2 - d; }
    else if (opuesto === "S") { x = e.x + H2 + t; y = e.y + H2; }
    else if (opuesto === "E") { [w, d] = [d, w]; x = e.x + e.w - H2 - w; y = e.y + H2 + t; }
    else { [w, d] = [d, w]; x = e.x + H2; y = e.y + H2 + t; }
    out.push({ k, m, x, y, w, h: d, cx: x + w / 2, cy: y + d / 2, e, pared: opuesto });
    t += (opuesto === "N" || opuesto === "S" ? m.w : m.w) + 15;
  }
  return out;
}
function dibMueble(v, f) {
  v.rect(f.x, f.y, f.w, f.h, "MOBILIARIO");
  if (f.k === "WC") { const [cx, cy] = v.p(f.cx, f.cy); v.d.circ([cx, cy], v.l(Math.min(f.w, f.h) / 2.6), "MOBILIARIO"); }
  if (f.k === "REG") { v.linea([f.x, f.y], [f.x + f.w, f.y + f.h], "MOBILIARIO"); v.linea([f.x + f.w, f.y], [f.x, f.y + f.h], "MOBILIARIO"); }
  if (f.k === "LAV" || f.k === "FRE" || f.k === "LVD") v.rect(f.x + 8, f.y + 8, f.w - 16, f.h - 16, "MOBILIARIO");
  if (f.k === "LVA") { const [cx, cy] = v.p(f.cx, f.cy); v.d.circ([cx, cy], v.l(Math.min(f.w, f.h) / 3), "MOBILIARIO"); }
}
function escaleraDib(v, e) {
  const largoY = e.l >= e.w, n = Math.floor(((largoY ? e.l : e.w) - MURO) / 28);
  for (let i = 1; i < n; i++) { const t = (largoY ? e.y : e.x) + H2 + i * 28; if (largoY) v.linea([e.x + H2, t], [e.x + e.w - H2, t], "MOBILIARIO"); else v.linea([t, e.y + H2], [t, e.y + e.l - H2], "MOBILIARIO"); }
  if (largoY) { const xm = e.x + e.w / 2; v.linea([xm, e.y + 40], [xm, e.y + e.l - 40], "MOBILIARIO"); v.linea([xm, e.y + e.l - 40], [xm - 12, e.y + e.l - 60], "MOBILIARIO"); v.linea([xm, e.y + e.l - 40], [xm + 12, e.y + e.l - 60], "MOBILIARIO"); }
}
function cotasPlanta(v, es) {
  const E = ext(es), xs = [...new Set(es.flatMap(e => [e.x, e.x + e.w]))].sort((a, b) => a - b), ys = [...new Set(es.flatMap(e => [e.y, e.y + e.l]))].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) v.cota([xs[i - 1], E.y0 - 40], [xs[i], E.y0 - 40], `${xs[i] - xs[i - 1]}`, -4);
  v.cota([E.x0, E.y0 - 40], [E.x1, E.y0 - 40], `${E.x1 - E.x0}`, -10);
  for (let i = 1; i < ys.length; i++) v.cota([E.x0 - 40, ys[i - 1]], [E.x0 - 40, ys[i]], `${ys[i] - ys[i - 1]}`, -4);
  v.cota([E.x0 - 40, E.y0], [E.x0 - 40, E.y1], `${E.y1 - E.y0}`, -10);
}
// ubica varias plantas lado a lado dentro del área útil (705 × 560 mm aprox.) dejando espacio para tablas
function acomodo(E, n, anchoUtil, altoUtil) {
  const W = E.x1 - E.x0 + 220, H = E.y1 - E.y0 + 260;
  const esc = K.escala(Math.max(W * n, H * anchoUtil / altoUtil), anchoUtil, [20, 25, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500]);
  return { esc, paso: W * 10 / esc };
}
const nivelTxt = n => n === 1 ? "PLANTA BAJA" : n === 2 ? "PLANTA ALTA" : `NIVEL ${n}`;

/* ---------- instalación eléctrica ---------- */
function electrica(m) {
  const pts = [], circ = {}, add = (id, desc, va, amp) => { circ[id] = circ[id] || { id, desc, lum: 0, cont: 0, va: 0, amp }; return circ[id]; };
  let nA = 1, nC = 1, carA = null, carC = null;
  for (const n of niveles(m.esp)) {
    carA = add(`A${nA}`, `Alumbrado ${nivelTxt(n).toLowerCase()}`, 0, 15); carC = add(`C${nC}`, `Contactos ${nivelTxt(n).toLowerCase()}`, 0, 15);
    for (const e of m.esp.filter(q => q.niv === n)) {
      const area = e.w * e.l / 1e4, nl = e.tipo === "cocina" || area > 16 ? 2 : 1;
      for (let i = 0; i < nl; i++) {
        const [x, y] = nl === 1 ? [e.x + e.w / 2, e.y + e.l / 2] : (e.w >= e.l ? [e.x + e.w * (i + 1) / 3, e.y + e.l / 2] : [e.x + e.w / 2, e.y + e.l * (i + 1) / 3]);
        if (carA.va + 20 > 1200) { nA++; carA = add(`A${nA}`, `Alumbrado ${nivelTxt(n).toLowerCase()}`, 0, 15); }
        carA.lum++; carA.va += 20; pts.push({ t: "lum", x, y, n, c: carA.id });
      }
      // contactos
      let nc = { cocina: 4, lavanderia: 2, bano: 1, medio_bano: 1, escalera: 0, pasillo: 1, bodega: 1, cochera: 1 }[e.tipo];
      if (nc === undefined) nc = Math.max(2, Math.ceil(2 * (e.w + e.l) / 360));
      let cc = carC;
      if (e.tipo === "cocina") cc = add(`K${n}`, "Contactos cocina (20 A)", 0, 20);
      if (e.tipo === "lavanderia") cc = add(`L${n}`, "Lavadora y contactos lavandería (20 A)", 0, 20);
      const L = Object.entries(lados(e)).filter(([k]) => k !== e.pu).concat(Object.entries(lados(e)).filter(([k]) => k === e.pu));
      for (let i = 0; i < nc; i++) {
        const [, s] = L[i % L.length], f = i < L.length ? 0.5 : 0.25, t = s.a + (s.b - s.a) * f, ci = s.c + s.dentro * (H2 + 12);
        const [x, y] = s.o === "h" ? [t, ci] : [ci, t];
        if (cc === carC && carC.cont >= 8) { nC++; carC = add(`C${nC}`, `Contactos ${nivelTxt(n).toLowerCase()}`, 0, 15); cc = carC; }
        cc.cont++; cc.va += e.tipo === "lavanderia" && i === 0 ? 1500 : 180;
        pts.push({ t: /bano/.test(e.tipo) ? "contGF" : "cont", x, y, n, c: cc.id });
      }
      // apagador junto a la puerta
      const s = lados(e)[e.pu]; if (s) { const t = s.a + 30 + (/bano/.test(e.tipo) ? 75 : 90) + 20, ci = s.c + s.dentro * (H2 + 15); pts.push({ t: "apag", x: s.o === "h" ? Math.min(t, s.b - 20) : ci, y: s.o === "h" ? ci : Math.min(t, s.b - 20), n }); }
    }
    nA++; nC++;
  }
  const e1 = m.esp.filter(q => q.niv === niveles(m.esp)[0]), tb = e1.find(q => q.tipo === "cochera") || e1.find(q => q.pu === "S") || e1[0];
  if (tb) pts.push({ t: "tab", x: tb.x + H2 + 30, y: tb.y + H2 + 15, n: tb.niv });
  const lista = Object.values(circ).filter(c => c.va > 0);
  const area = m.esp.reduce((a, e) => a + e.w * e.l / 1e4, 0);
  const especiales = lista.filter(c => /^[KL]/.test(c.id)).length * 1500;
  const general = 33 * area + especiales, demanda = Math.min(general, 3000) + Math.max(0, general - 3000) * 0.35;
  return { pts, circ: lista, area, general, demanda, corriente: demanda / 127 };
}
function simbolo(v, d, p) {
  const [x, y] = v.p(p.x, p.y), r = 1.6;
  if (p.t === "lum") { d.circ([x, y], 2.2, "ELECTRICA"); d.linea([x - 1.55, y - 1.55], [x + 1.55, y + 1.55], "ELECTRICA"); d.linea([x - 1.55, y + 1.55], [x + 1.55, y - 1.55], "ELECTRICA"); d.texto([x + 2.8, y + 1], p.c, 1.8, "ELECTRICA"); }
  if (p.t === "cont" || p.t === "contGF") { d.circ([x, y], r, "ELECTRICA"); d.linea([x - 0.6, y - 0.8], [x - 0.6, y + 0.8], "ELECTRICA"); d.linea([x + 0.6, y - 0.8], [x + 0.6, y + 0.8], "ELECTRICA"); d.texto([x + 2.2, y - 0.6], p.t === "contGF" ? `${p.c} CF` : p.c, 1.6, "ELECTRICA"); }
  if (p.t === "apag") { d.circ([x, y], 1, "ELECTRICA", true); d.texto([x + 1.6, y - 0.6], "S", 1.8, "ELECTRICA"); }
  if (p.t === "tab") { d.rect(x - 3, y - 1, 6, 2.2, "ELECTRICA"); d.texto([x, y - 4.2], "TABLERO", 1.8, "ELECTRICA", "centro"); }
}

/* ---------- hidrosanitaria ---------- */
function hidro(m) {
  const fx = m.esp.flatMap(e => muebles(e));
  const cuenta = {}; fx.forEach(f => { cuenta[f.k] = (cuenta[f.k] || 0) + 1; });
  const um = fx.reduce((a, f) => a + f.m.um, 0), ud = fx.reduce((a, f) => a + f.m.ud, 0), Q = hunter(um);
  const dReq = Math.sqrt(4 * Q / 1000 / (Math.PI * 1.5)) * 1000, dToma = DIAM.find(dd => dd >= dReq) || 50;
  return { fx, cuenta, um, ud, Q, dToma: Math.max(19, dToma), dReq };
}

/* ---------- hojas ---------- */
function hojaPlantas(base, m, tipo) {
  const titulo = { A: "Plantas arquitectónicas", IE: "Instalación eléctrica", IH: "Instalación hidrosanitaria" }[tipo];
  const clave = { A: "A-01", IE: "IE-01", IH: "IH-01" }[tipo];
  const notas = {
    A: ["Cotas en cm a ejes de muro; muros de block de 15 cm salvo indicación.", "NPT = nivel de piso terminado. Verificar niveles contra plano topográfico.", "Puertas 90 cm (baños 75 cm); ventanas según fachada.", "Coordinar con planos estructurales E-01 y E-02 antes de construir."],
    IE: ["Instalación conforme a NOM-001-SEDE vigente.", "Conductores de cobre THHW-LS: 14 AWG en circuitos de 15 A, 12 AWG en 20 A; tierra física en todos los contactos.", "Tubería conduit PVC pesado o poliducto 16 mm (1/2\") salvo indicación.", "Contactos en baños y cerca de tarjas con protección por falla a tierra (CF).", "Acometida y medición según especificación de CFE."],
    IH: ["Agua: tubería de cobre tipo M o CPVC; diámetros según tabla.", "Drenaje: PVC sanitario con pendiente mínima de 2 %; inodoros a 100 mm.", "Registros a no más de 10 m y en cada cambio de dirección; conexión según lineamientos de CESPT.", "Prueba de hermeticidad de agua a 1.5 veces la presión de trabajo, sin fugas en 3 h.", "Gasto por método de Hunter (referencia); verificar con el reglamento local."],
  }[tipo];
  const d = K.hoja({ ...base, contenido: titulo, clave, notas });
  const nv = niveles(m.esp); if (!nv.length) return { d, clave, nombre: titulo };
  const E = ext(m.esp), anchoUtil = tipo === "A" ? 680 : 470, { esc, paso } = acomodo(E, nv.length, anchoUtil, tipo === "A" ? 500 : 520);
  const el = tipo === "IE" ? electrica(m) : null, hd = tipo === "IH" ? hidro(m) : null;
  nv.forEach((n, i) => {
    const es = m.esp.filter(e => e.niv === n), vs = vanos(es), x0 = 30 + 110 * 10 / esc + i * paso, y0 = Math.max(40 + 230 * 10 / esc, (600 - (E.y1 - E.y0) * 10 / esc) / 2 + 20);
    const v = new K.Vista(d, x0 - E.x0 * 10 / esc, y0 - E.y0 * 10 / esc, esc);
    muros(v, d, es, vs, tipo === "A" ? "MUROS" : "OCULTO");
    for (const e of es) {
      if (e.tipo === "escalera") escaleraDib(v, e);
      if (tipo !== "IE") muebles(e).forEach(f => dibMueble(v, f));
      if (e.tipo === "recamara" && tipo === "A") { const bw = Math.min(150, e.w - 60), bl = Math.min(190, e.l - 60); if (bw > 80 && bl > 120) v.rect(e.x + (e.w - bw) / 2, e.y + e.l - H2 - bl - (e.pu === "N" ? 120 : 0), bw, bl, "MOBILIARIO"); }
      const [cx, cy] = v.p(e.x + e.w / 2, e.y + e.l / 2);
      if (tipo === "A") { d.texto([cx, cy + 1], e.nom.toUpperCase(), 2.4, "TEXTO", "centro"); d.texto([cx, cy - 3], `${(e.w * e.l / 1e4).toFixed(1)} m²`, 1.9, "TEXTO", "centro"); }
      else d.texto([cx, cy + (tipo === "IE" ? 4 : 1)], e.nom, 1.8, "TEXTO", "centro");
    }
    if (tipo === "A") cotasPlanta(v, es);
    if (tipo === "IE") el.pts.filter(p => p.n === n).forEach(p => simbolo(v, d, p));
    if (tipo === "IH") {
      const fxs = hd.fx.filter(f => f.e.niv === n), first = n === nv[0];
      const ox = first ? E.x0 + 60 : (fxs[0] ? fxs[0].e.x + H2 + 10 : E.x0 + 60), oy = first ? E.y0 - 60 : (fxs[0] ? fxs[0].e.y + H2 + 10 : E.y0 + 60);
      if (first) { v.rect(ox - 20, oy - 12, 40, 24, "HIDRAULICA"); const [mx, my] = v.p(ox, oy - 30); d.texto([mx, my], "TOMA / MEDIDOR", 1.8, "HIDRAULICA", "centro"); }
      else { const [sx, sy] = v.p(ox, oy); d.circ([sx, sy], 1.6, "HIDRAULICA"); d.texto([sx + 2.5, sy - 3], "SAF / SAC", 1.7, "HIDRAULICA"); }
      // calentador en lavandería (planta baja) o junto a la toma
      const lav = m.esp.find(e => e.tipo === "lavanderia" && e.niv === nv[0]), cal = lav ? { x: lav.x + lav.w - H2 - 45, y: lav.y + H2 + 45 } : { x: ox + 80, y: oy + 80 };
      if (first) { const [kx, ky] = v.p(cal.x, cal.y); d.circ([kx, ky], v.l(25), "AGUA_CALIENTE"); d.texto([kx, ky - 0.8], "CAL", 1.8, "AGUA_CALIENTE", "centro"); }
      fxs.forEach(f => {
        v.linea([ox, oy], [ox, f.cy], "HIDRAULICA"); v.linea([ox, f.cy], [f.cx, f.cy], "HIDRAULICA");
        if (f.m.caliente) { const sx = first ? cal.x : ox + 10, sy = first ? cal.y : oy; v.linea([sx, sy], [sx, f.cy + 10], "AGUA_CALIENTE"); v.linea([sx, f.cy + 10], [f.cx, f.cy + 10], "AGUA_CALIENTE"); }
        const [px, py] = v.p(f.cx, f.cy); d.texto([px + 1.5, py + 2], `${f.k} ${f.m.dren}`, 1.5, "SANITARIA");
      });
      // drenaje: cada mueble baja al colector frente al predio (PB) o a una bajada (PA)
      const yc = E.y0 - 110;
      if (first) {
        const xs = fxs.map(f => f.cx).concat(m.esp.filter(e => e.niv !== n).flatMap(e => muebles(e)).map(f => f.e.x + H2 + 20));
        fxs.forEach(f => { v.linea([f.cx + 15, f.cy], [f.cx + 15, yc], "SANITARIA"); });
        if (xs.length) { const xa = Math.min(...xs), xb = Math.max(...xs) + 15; v.linea([xa, yc], [xb, yc], "SANITARIA"); [xa, xb].forEach(x => v.rect(x - 20, yc - 20, 40, 40, "SANITARIA")); const [rx, ry] = v.p(xa - 20, yc - 34); d.texto([rx, ry], "REGISTRO 40×60 → RED MUNICIPAL (CESPT)", 1.7, "SANITARIA"); }
        m.esp.filter(e => e.niv !== n).flatMap(e => muebles(e)).forEach(f => { const bx = f.e.x + H2 + 20, by = f.e.y + H2 + 20; v.linea([bx, by], [bx, yc], "SANITARIA"); });
      } else {
        const ban = {}; fxs.forEach(f => { const bx = f.e.x + H2 + 20, by = f.e.y + H2 + 20; ban[f.e.i] = [bx, by]; v.linea([f.cx, f.cy], [bx, f.cy], "SANITARIA"); v.linea([bx, f.cy], [bx, by], "SANITARIA"); });
        Object.values(ban).forEach(([bx, by]) => { const [px, py] = v.p(bx, by); d.circ([px, py], 1.8, "SANITARIA"); d.texto([px + 2.5, py - 2.5], "BAN 100", 1.7, "SANITARIA"); });
      }
    }
    v.titulo((E.x0 + E.x1) / 2, E.y0 - 170 - 60 * esc / 50, nivelTxt(n));
  });
  // tablas
  const tx = 30 + anchoUtil + 20;
  if (tipo === "IE") {
    K.tabla(d, tx, 560, ["Circ.", "Descripción", "Lum.", "Cont.", "VA", "A", "Prot.", "Cal."], el.circ.map(c => [c.id, c.desc.slice(0, 26), String(c.lum), String(c.cont), String(Math.round(c.va)), (c.va / 127).toFixed(1), `1×${c.amp}`, c.amp > 15 ? "12" : "14"]), [10, 52, 9, 9, 12, 10, 11, 8], "CUADRO DE CARGAS");
    const y2 = 560 - (el.circ.length + 2) * 6 - 14;
    K.tabla(d, tx, y2, ["Concepto", "Valor"], [["Área construida", `${el.area.toFixed(1)} m²`], ["Carga general 33 VA/m² + circuitos 20 A", `${Math.round(el.general)} VA`], ["Demanda (3000 VA 100 %, resto 35 %)", `${Math.round(el.demanda)} VA`], ["Corriente a 127 V", `${el.corriente.toFixed(1)} A`], ["Acometida sugerida", el.corriente > 40 ? "2F-3H 220/127 V" : "1F-2H 127 V"]], [75, 46], "CARGA DE DEMANDA (NOM-001-SEDE art. 220)");
    const y3 = y2 - 7 * 6 - 14; K.tabla(d, tx, y3, ["Símbolo", "Significado"], [["⊗ / X", "Luminaria LED 20 W"], ["○ ||", "Contacto doble 180 VA"], ["CF", "Contacto con falla a tierra"], ["● S", "Apagador sencillo"], ["TABLERO", "Centro de carga"]], [25, 70], "SIMBOLOGÍA");
  }
  if (tipo === "IH") {
    const filas = Object.entries(hd.cuenta).map(([k, n]) => [MUEBLES[k].nom, String(n), String(MUEBLES[k].um), String(n * MUEBLES[k].um), String(MUEBLES[k].ud * n), `${MUEBLES[k].dren} mm`]);
    K.tabla(d, tx, 560, ["Mueble", "Cant.", "UM", "UM tot.", "UD", "Desagüe"], filas, [42, 12, 10, 14, 10, 18], "UNIDADES MUEBLE");
    const y2 = 560 - (filas.length + 2) * 6 - 14;
    K.tabla(d, tx, y2, ["Concepto", "Valor"], [["UM agua total", String(hd.um)], ["Gasto probable (Hunter, tanque)", `${hd.Q.toFixed(2)} l/s`], ["Diámetro toma (v ≤ 1.5 m/s)", `${hd.dToma} mm`], ["UD drenaje total", String(hd.ud)], ["Colector y bajadas", "100 mm, pendiente 2 %"]], [70, 36], "CÁLCULO HIDRÁULICO");
    const y3 = y2 - 7 * 6 - 14; K.tabla(d, tx, y3, ["Línea", "Significado"], [["Azul continua", "Agua fría"], ["Roja punteada", "Agua caliente"], ["Verde", "Drenaje sanitario"], ["SAF/SAC", "Subida agua fría / caliente"], ["BAN", "Bajada de aguas negras"]], [32, 60], "SIMBOLOGÍA");
  }
  return { d, clave, nombre: titulo };
}
function hojaFachadaCorte(base, m) {
  const d = K.hoja({ ...base, contenido: "Fachada principal y corte A-A'", clave: "A-02", notas: ["Alturas en cm; niveles en m sobre NPT ±0.00.", "Ventanas: repisón a 1.00 m (baños 1.60 m).", "Pretil de azotea con chaflán e impermeabilización.", "Ver detalles estructurales en E-01 y E-02."] });
  const nv = niveles(m.esp); if (!nv.length) return { d, clave: "A-02", nombre: "Fachada y corte" };
  const E = ext(m.esp), Ht = nv.length * m.hn + m.pretil, W = E.x1 - E.x0;
  const esc = K.escala(Math.max(W * 2 + 500, (Ht + 300) * 680 / 480), 680, [25, 40, 50, 75, 100, 125, 150, 200, 250]);
  // fachada sur
  const zb = Math.max(150, (600 - (Ht + 200) * 10 / esc) / 2 + 40), v = new K.Vista(d, 50 - E.x0 * 10 / esc, zb, esc);
  v.linea([E.x0 - 100, 0], [E.x1 + 100, 0], "SUELO");
  v.rect(E.x0, 0, W, nv.length * m.hn, "MUROS"); v.rect(E.x0, nv.length * m.hn, W, m.pretil, "MUROS");
  nv.forEach((n, i) => {
    const z = i * m.hn; if (i) v.linea([E.x0, z], [E.x1, z], "MUROS");
    const es = m.esp.filter(e => e.niv === n), vs = vanos(es).filter(q => q.lado === "S" && exterior(q.e, lados(q.e).S, es).some(([a, b]) => q.a >= a - 1 && q.b <= b + 1));
    vs.forEach(q => { if (q.tipo === "ventana") { v.rect(q.a, z + q.sill, q.b - q.a, q.alto, "VENTANAS"); v.linea([(q.a + q.b) / 2, z + q.sill], [(q.a + q.b) / 2, z + q.sill + q.alto], "VENTANAS"); } else if (i === 0) { v.rect(q.a, z, q.b - q.a, 210, "PUERTAS"); } });
    const [lx, ly] = v.p(E.x1 + 30, z); d.texto([lx, ly + 1], `N ${(z / 100).toFixed(2)}`, 2, "COTAS");
    v.cota([E.x1, z], [E.x1, z + m.hn], `${m.hn}`, 14);
  });
  v.titulo((E.x0 + E.x1) / 2, -60 * esc / 25 - 30, "FACHADA PRINCIPAL (SUR)");
  // corte A-A' a la mitad del fondo
  let ym = (E.y0 + E.y1) / 2; const bordes = m.esp.flatMap(e => [e.y, e.y + e.l]); for (let k = 0; k < 40 && bordes.some(b => Math.abs(b - ym) < 20); k++) ym += (k % 2 ? 1 : -1) * 10 * (k + 1);
  const xo = 50 + (W + 300) * 10 / esc;
  const c = new K.Vista(d, xo - E.x0 * 10 / esc, zb, esc), z0 = Math.round((RES.zapata ? RES.zapata.Df : 1.0) * 100);
  c.linea([E.x0 - 100, 0], [E.x1 + 100, 0], "SUELO");
  nv.forEach((n, i) => {
    const z = i * m.hn, es = m.esp.filter(e => e.niv === n && e.y < ym && e.y + e.l > ym);
    c.rect(E.x0 - H2, z + m.hn - m.esl, W + MURO, m.esl, "CONCRETO");
    const xs = [...new Set(es.flatMap(e => [e.x, e.x + e.w]))];
    xs.forEach(x => { c.linea([x - H2, z], [x - H2, z + m.hn - m.esl], "MUROS"); c.linea([x + H2, z], [x + H2, z + m.hn - m.esl], "MUROS"); if (i === 0) { c.rect(x - 30, -z0, 60, 25, "CONCRETO"); c.linea([x - H2, -z0 + 25], [x - H2, 0], "CONCRETO"); c.linea([x + H2, -z0 + 25], [x + H2, 0], "CONCRETO"); } });
    es.forEach(e => { const [tx, ty] = c.p(e.x + e.w / 2, z + 110); d.texto([tx, ty], e.nom, 1.9, "TEXTO", "centro"); });
    c.cota([E.x1 + H2, z], [E.x1 + H2, z + m.hn], `${m.hn}`, 10);
    const [lx, ly] = c.p(E.x0 - 60, z + 5); d.texto([lx, ly], `NPT ${(z / 100).toFixed(2)}`, 1.9, "COTAS", "der");
  });
  c.rect(E.x0 - H2, nv.length * m.hn, MURO, m.pretil, "MUROS"); c.rect(E.x1 - H2, nv.length * m.hn, MURO, m.pretil, "MUROS");
  c.cota([E.x0 - H2, -z0], [E.x0 - H2, 0], `Df ${z0}`, -8);
  c.titulo((E.x0 + E.x1) / 2, -z0 - 60 * esc / 25 - 30, "CORTE A-A'");
  return { d, clave: "A-02", nombre: "Fachada y corte" };
}
function hojas(base) {
  const m = leer(); if (!m.esp.length) return [];
  return [hojaPlantas(base, m, "A"), hojaFachadaCorte(base, m), hojaPlantas(base, m, "IE"), hojaPlantas(base, m, "IH")];
}
function resumen() {
  const m = leer(); if (!m.esp.length) return null;
  const el = electrica(m), hd = hidro(m);
  return {
    cargas: { enc: ["Circuito", "Descripción", "Lum.", "Cont.", "VA", "A", "Protección", "Calibre AWG"], filas: el.circ.map(c => [c.id, c.desc, c.lum, c.cont, Math.round(c.va), (c.va / 127).toFixed(1), `1×${c.amp} A`, c.amp > 15 ? "12" : "14"]),
      notas: [`Área ${el.area.toFixed(1)} m²; carga general ${Math.round(el.general)} VA; demanda ${Math.round(el.demanda)} VA (${el.corriente.toFixed(1)} A a 127 V). Acometida sugerida: ${el.corriente > 40 ? "2F-3H 220/127 V" : "1F-2H 127 V"}, sujeta a CFE.`] },
    hidro: { enc: ["Mueble", "Cantidad", "UM agua", "UM total", "UD drenaje", "Desagüe"], filas: Object.entries(hd.cuenta).map(([k, n]) => [MUEBLES[k].nom, n, MUEBLES[k].um, n * MUEBLES[k].um, n * MUEBLES[k].ud, `${MUEBLES[k].dren} mm`]),
      notas: [`UM totales ${hd.um} → gasto probable ${hd.Q.toFixed(2)} l/s (Hunter, muebles de tanque; referencia). Toma de ${hd.dToma} mm con velocidad ≤ 1.5 m/s. UD de drenaje ${hd.ud}; colector de 100 mm al 2 %.`] },
    el, hd,
  };
}

/* ---------- vista previa SVG ---------- */
const HEX = { 1: "#c0392b", 3: "#2e7d4f", 4: "#00838f", 5: "#1f5f8b", 6: "#8e44ad", 7: "#1d2328", 8: "#8a939b" };
function svg(d) {
  const H = d.h, col = c => HEX[K.CAPAS[c] || 7] || "#1d2328", o = [`<rect x="0" y="0" width="${d.w}" height="${H}" fill="#fff"/>`];
  for (const e of d.e) {
    if (e.t === "L") { const dash = e.capa === "OCULTO" || e.capa === "AGUA_CALIENTE" || e.lt === "DASHED" ? ' stroke-dasharray="2 1"' : e.capa === "EJES" ? ' stroke-dasharray="4 1 0.7 1"' : ""; const w = e.capa === "MARCO" ? 0.35 : ["COTAS", "EJES", "OCULTO", "SUELO", "MOBILIARIO"].includes(e.capa) ? 0.12 : 0.22; o.push(`<line x1="${e.p1[0].toFixed(2)}" y1="${(H - e.p1[1]).toFixed(2)}" x2="${e.p2[0].toFixed(2)}" y2="${(H - e.p2[1]).toFixed(2)}" stroke="${col(e.capa)}" stroke-width="${w}"${dash}/>`); }
    else if (e.t === "C") o.push(`<circle cx="${e.c[0].toFixed(2)}" cy="${(H - e.c[1]).toFixed(2)}" r="${e.r.toFixed(2)}" fill="${e.fill ? col(e.capa) : "none"}" stroke="${col(e.capa)}" stroke-width="0.15"/>`);
    else if (e.t === "A") { const p = a => [e.c[0] + e.r * Math.cos(a * Math.PI / 180), H - (e.c[1] + e.r * Math.sin(a * Math.PI / 180))], [x0, y0] = p(e.a0), [x1, y1] = p(e.a1); o.push(`<path d="M${x0.toFixed(2)},${y0.toFixed(2)} A${e.r.toFixed(2)},${e.r.toFixed(2)} 0 0 0 ${x1.toFixed(2)},${y1.toFixed(2)}" fill="none" stroke="${col(e.capa)}" stroke-width="0.12"/>`); }
    else if (e.t === "T") o.push(`<text x="${e.p[0].toFixed(2)}" y="${(H - e.p[1]).toFixed(2)}" font-size="${(e.h * 1.38).toFixed(2)}" font-family="Helvetica,Arial,sans-serif" fill="${col(e.capa)}" text-anchor="${e.alin === "centro" ? "middle" : e.alin === "der" ? "end" : "start"}"${e.rot ? ` transform="rotate(${-e.rot} ${e.p[0].toFixed(2)} ${(H - e.p[1]).toFixed(2)})"` : ""}>${String(e.s).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`);
  }
  return o.join("");
}
let HOJAS = [];
function render() {
  const m = leer(), warn = [];
  for (const n of niveles(m.esp)) { const es = m.esp.filter(e => e.niv === n); for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) { const a = es[i], b = es[j]; if (a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.l - 1 && b.y < a.y + a.l - 1) warn.push(`Nivel ${n}: "${a.nom}" y "${b.nom}" se traslapan.`); } }
  $("#a-warn").innerHTML = warn.map(w => `<li>${esc(w)}</li>`).join("");
  let pl; try { pl = K.planos(); } catch (e) { console.error(e); return; }
  HOJAS = [{ clave: "E-01", nombre: "Cimentación", d: pl.h1 }, { clave: "E-02", nombre: "Trabes y columnas", d: pl.h2 }, ...pl.extra];
  const sel = $("#a-sheet"), cur = sel.value || "A-01";
  sel.innerHTML = HOJAS.map(h => `<option value="${h.clave}" ${h.clave === cur ? "selected" : ""}>${h.clave} · ${esc(h.nombre)}</option>`).join("");
  const h = HOJAS.find(x => x.clave === sel.value) || HOJAS[0]; $("#a-svg").innerHTML = svg(h.d);
  const r = resumen();
  if (r) {
    $("#a-cargas").innerHTML = `<tr>${r.cargas.enc.map(x => `<th>${x}</th>`).join("")}</tr>` + r.cargas.filas.map(f => `<tr>${f.map((x, i) => `<td class="${i > 1 ? "n" : ""}">${esc(x)}</td>`).join("")}</tr>`).join("");
    $("#a-cnotes").innerHTML = r.cargas.notas.map(x => `<li>${esc(x)}</li>`).join("");
    $("#a-hidro").innerHTML = `<tr>${r.hidro.enc.map(x => `<th>${x}</th>`).join("")}</tr>` + r.hidro.filas.map(f => `<tr>${f.map((x, i) => `<td class="${i ? "n" : ""}">${esc(x)}</td>`).join("")}</tr>`).join("");
    $("#a-hnotes").innerHTML = r.hidro.notas.map(x => `<li>${esc(x)}</li>`).join("");
  }
}
$("#a-sheet").addEventListener("change", () => { const h = HOJAS.find(x => x.clave === $("#a-sheet").value); if (h) $("#a-svg").innerHTML = svg(h.d); });
$("#a-dxf").onclick = () => { const h = HOJAS.find(x => x.clave === $("#a-sheet").value); if (h) K.save(new Blob([h.d.dxf()], { type: "application/dxf" }), `${h.clave}_${K.slug(h.nombre)}.dxf`); };
$("#a-pdf").onclick = () => { const h = HOJAS.find(x => x.clave === $("#a-sheet").value); if (h) K.save(K.pdf([h.d]), `${h.clave}_${K.slug(h.nombre)}.pdf`); };
document.querySelector('#tabs button[data-p="arq"]').addEventListener("click", () => setTimeout(render, 0));
window.VC_ARQ = { hojas, resumen, render };
if (!document.getElementById("p-arq").hidden) render();
})();
