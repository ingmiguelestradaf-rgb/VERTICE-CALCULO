#!/usr/bin/env node
// Genera los contratos en Word (.docx) con membrete Vértice a partir de un JSON de proyecto.
// Uso: node generar_contratos.js datos.json carpeta_salida [precio_alzado|precios_unitarios|subcontrato|arrendamiento ...]
// Sin tipos genera los cuatro. Los campos vacíos salen como "________" para llenarse a mano.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, LevelFormat, TabStopType,
} = require("docx");
const { ORD, contratos } = require("./clausulas");

const [, , datosPath, salida = ".", ...tipos] = process.argv;
if (!datosPath) { console.error("Uso: node generar_contratos.js datos.json carpeta_salida [tipos...]"); process.exit(1); }
const D = JSON.parse(fs.readFileSync(datosPath, "utf8"));

// ---------- número a letras (pesos mexicanos) ----------
const U = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
  "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO",
  "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DEC = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
function menorMil(n) {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100), r = n % 100;
  let s = CEN[c];
  if (r) s += (s ? " " : "") + (r < 30 ? U[r] : DEC[Math.floor(r / 10)] + (r % 10 ? " Y " + U[r % 10] : ""));
  return s;
}
function letras(n) {
  if (n === 0) return "CERO";
  const mill = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000;
  let s = "";
  if (mill) s += mill === 1 ? "UN MILLÓN" : letras(mill) + " MILLONES";
  if (miles) s += (s ? " " : "") + (miles === 1 ? "MIL" : menorMil(miles) + " MIL");
  if (resto) s += (s ? " " : "") + menorMil(resto);
  return s;
}
function pesos(x) {
  const n = Math.round(Number(x) * 100) / 100;
  const ent = Math.floor(n), cts = Math.round((n - ent) * 100);
  const fmt = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const de = ent % 1e6 === 0 && ent > 0 ? " DE" : "";
  return `$${fmt} (${letras(ent)}${de} PESOS ${String(cts).padStart(2, "0")}/100 M.N.)`;
}

// ---------- ayudantes de llenado ----------
const BLANCO = "________________";
const get = p => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), D);
const vacio = x => x === undefined || x === null || x === "";
const h = {
  raw: get,
  v: p => (vacio(get(p)) ? BLANCO : String(get(p))),
  m: p => (vacio(get(p)) ? "$" + BLANCO : pesos(get(p))),
  p: p => (vacio(get(p)) ? "___ %" : `${get(p)} %`),
  mTotal: () => (vacio(get("contrato.monto")) ? "$" + BLANCO : pesos(get("contrato.monto") * (1 + Number(get("contrato.iva_pct") || 0) / 100))),
  nombreEmpresa: () => {
    const t = get("empresa.titular");
    if (get("empresa.tipo_persona") === "moral") return h.v("empresa.nombre_comercial");
    return (vacio(t) ? BLANCO : t) + `, «${h.v("empresa.nombre_comercial")}»`;
  },
};

// ---------- estilo ----------
const FONT = "Arial", OSCURO = "1D2328", ACENTO = "B23B2E", GRIS = "5B656E";
const W = 12240, MARGEN = 1260, ANCHO = W - 2 * MARGEN; // carta, márgenes 0.875"
const par = (runs, o = {}) => new Paragraph({ spacing: { after: 120, line: 276 }, alignment: AlignmentType.JUSTIFIED, ...o, children: runs });
const t = (text, o = {}) => new TextRun({ text, font: FONT, size: 20, ...o });

function encabezado(numero) {
  return new Header({ children: [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: ANCHO }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACENTO, space: 4 } },
      children: [t("VÉRTICE", { bold: true, size: 26, color: OSCURO }), t("  Ingeniería, Arquitectura y Proyectos", { size: 16, color: GRIS }),
        t("\t" + `Contrato ${numero}`, { size: 16, color: GRIS })],
    }),
  ]});
}
function pie() {
  return new Footer({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: ANCHO }],
    children: [t("Rúbricas: ________   ________", { size: 16, color: GRIS }),
      new TextRun({ font: FONT, size: 16, color: GRIS, children: ["\tPágina ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES] })],
  })]});
}

function nombreParte(quien) {
  if (quien === "empresa") {
    if (get("empresa.tipo_persona") === "moral")
      return `${h.v("empresa.nombre_comercial").toUpperCase()}, REPRESENTADA POR ${h.v("empresa.representante").toUpperCase()}`;
    return `${vacio(get("empresa.titular")) ? BLANCO : get("empresa.titular").toUpperCase()}, POR SU PROPIO DERECHO, QUIEN REALIZA ACTIVIDADES EMPRESARIALES CON EL NOMBRE COMERCIAL «${h.v("empresa.nombre_comercial").toUpperCase()}»`;
  }
  const n = h.v("contraparte.nombre").toUpperCase();
  return get("contraparte.tipo_persona") === "moral" ? `${n}, REPRESENTADA EN ESTE ACTO POR ${h.v("contraparte.representante").toUpperCase()}` : `${n}, POR SU PROPIO DERECHO`;
}
function firmante(quien) {
  if (quien === "empresa") return get("empresa.tipo_persona") === "moral" ? h.v("empresa.representante") : (vacio(get("empresa.titular")) ? BLANCO : get("empresa.titular"));
  return get("contraparte.tipo_persona") === "moral" ? h.v("contraparte.representante") : h.v("contraparte.nombre");
}

const celdaBorde = { style: BorderStyle.SINGLE, size: 4, color: "BFC5CA" };
const SIN = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
function tablaFirmas(pares) {
  const w = ANCHO / 2;
  const celda = (lineas) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: { top: SIN, bottom: SIN, left: SIN, right: SIN },
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children: lineas.map((l, i) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: i === 1 ? 900 : 0 },
      children: [t(l, { bold: i === 0, size: i === 0 ? 20 : 18 })] })),
  });
  const filas = [];
  for (let i = 0; i < pares.length; i += 2) {
    filas.push(new TableRow({ cantSplit: true, children: [0, 1].map(k => pares[i + k]
      ? celda([pares[i + k][0], "_______________________________", pares[i + k][1]]) : celda([""])) }));
  }
  return new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [w, w], rows: filas });
}
function tablaEquipos() {
  const cols = [["Equipo", 2400], ["Marca / modelo", 1700], ["Serie", 1300], ["Horómetro inicial", 1150], ["Tarifa (sin IVA)", 1300], ["Mínimo", 1870]];
  const fila = (vals, head) => new TableRow({ tableHeader: head, children: vals.map((v, j) => new TableCell({
    width: { size: cols[j][1], type: WidthType.DXA },
    borders: { top: celdaBorde, bottom: celdaBorde, left: celdaBorde, right: celdaBorde },
    shading: head ? { type: ShadingType.CLEAR, fill: OSCURO, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({ children: [t(v, { size: 17, bold: head, color: head ? "FFFFFF" : undefined })] })],
  })) });
  const eq = get("arrendamiento.equipos") || [];
  const rows = [fila(cols.map(c => c[0]), true)];
  (eq.length ? eq : [{}]).forEach(e => rows.push(fila([
    e.descripcion || BLANCO, [e.marca, e.modelo].filter(Boolean).join(" ") || "________", e.serie || "________", String(e.horometro || "________"),
    e.tarifa ? `$${Number(e.tarifa).toLocaleString("en-US", { minimumFractionDigits: 2 })} / ${e.unidad || "hora"}` : "________", e.minimo || "________",
  ])));
  return new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: cols.map(c => c[1]), rows });
}

function construir(tipo) {
  const c = contratos[tipo](h);
  const kids = [];
  kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 240 },
    children: [t(c.titulo, { bold: true, size: 26, color: OSCURO })] }));
  const [p1, p2] = c.partes;
  kids.push(par([t(`${c.titulo} QUE CELEBRAN, POR UNA PARTE, ${nombreParte(p1[1])}, A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ «${p1[0]}»; Y POR LA OTRA, ${nombreParte(p2[1])}, A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ «${p2[0]}», Y EN CONJUNTO «LAS PARTES», AL TENOR DE LAS SIGUIENTES DECLARACIONES Y CLÁUSULAS:`, { size: 19 })]));
  kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 160 }, children: [t("D E C L A R A C I O N E S", { bold: true, color: OSCURO })] }));
  const romanos = ["I", "II", "III", "IV"];
  c.declaraciones.forEach((d, i) => {
    kids.push(par([t(`${romanos[i]}. ${d.titulo}`, { bold: true })], { keepNext: true }));
    d.items.forEach((it, j) => kids.push(par([t(`${romanos[i]}.${j + 1}. `, { bold: true }), t(it)], { indent: { left: 360 } })));
  });
  kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 160 }, children: [t("C L Á U S U L A S", { bold: true, color: OSCURO })] }));
  c.clausulas.forEach((cl, i) => {
    cl.p.forEach((txt, j) => kids.push(par(j === 0 ? [t(`${ORD[i]}. ${cl.t}. `, { bold: true }), t(txt)] : [t(txt)])));
    (cl.items || []).forEach(it => kids.push(new Paragraph({ numbering: { reference: "incisos", level: 0, instance: i + 1 }, spacing: { after: 80, line: 276 }, alignment: AlignmentType.JUSTIFIED, children: [t(it)] })));
    if (c.tablaEquipos && cl.t === "OBJETO") {
      kids.push(par([t("Anexo A. Relación de equipos:", { bold: true })], { keepNext: true }));
      kids.push(tablaEquipos());
      kids.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  });
  kids.push(par([t(`Leído que fue el presente contrato y enteradas las partes de su contenido y alcance legal, lo firman por duplicado en ${h.v("contrato.lugar")}, el ${h.v("contrato.fecha_firma")}.`)], { spacing: { before: 240, after: 240 } }));
  const firmas = [[`«${p1[0]}»`, firmante(p1[1])], [`«${p2[0]}»`, firmante(p2[1])], ["TESTIGO", h.v("contrato.testigo_1")], ["TESTIGO", h.v("contrato.testigo_2")]];
  kids.push(tablaFirmas(firmas));
  kids.push(new Paragraph({ spacing: { before: 360, after: 120 }, keepNext: true, children: [t("ANEXOS QUE FORMAN PARTE DEL CONTRATO", { bold: true, color: OSCURO })] }));
  c.anexos.forEach(a => kids.push(new Paragraph({ spacing: { after: 60 }, children: [t(a, { size: 19 })] })));
  kids.push(new Paragraph({ spacing: { before: 240 }, children: [t("Formato de Vértice para revisión. Verifique datos, anexos y la numeración de artículos contra el texto vigente, y obtenga la revisión de un abogado antes de firmar.", { size: 15, italics: true, color: GRIS })] }));

  const doc = new Document({
    creator: "Vértice Ingeniería, Arquitectura y Proyectos",
    title: c.titulo,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    numbering: { config: [{ reference: "incisos", levels: [{ level: 0, format: LevelFormat.LOWER_LETTER, text: "%1)", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: W, height: 15840 }, margin: { top: 1300, bottom: 1200, left: MARGEN, right: MARGEN, header: 600, footer: 500 } } },
      headers: { default: encabezado(h.v("contrato.numero")) },
      footers: { default: pie() },
      children: kids,
    }],
  });
  return { doc, archivo: c.archivo };
}

(async () => {
  fs.mkdirSync(salida, { recursive: true });
  const lista = tipos.length ? tipos : Object.keys(contratos);
  for (const tipo of lista) {
    if (!contratos[tipo]) { console.error("Tipo desconocido: " + tipo); process.exit(1); }
    const { doc, archivo } = construir(tipo);
    const ruta = path.join(salida, `${archivo}.docx`);
    fs.writeFileSync(ruta, await Packer.toBuffer(doc));
    console.log(ruta);
  }
})();
