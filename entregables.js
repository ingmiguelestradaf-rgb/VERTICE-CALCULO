/* Vértice Cálculo — entregables: memoria .docx, planos .dxf/.pdf y Excel .xlsx generados en el navegador.
   Escritores propios de ZIP, XLSX, PDF y DXF (sin dependencias); Word con la librería docx (MIT) incluida en vendor/. */
"use strict";
(function () {
const LEY = "Para revisión y firma del DRO / Corresponsable en Seguridad Estructural";

/* ---------------- utilidades de bytes ---------------- */
const CP1252 = { "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f };
const SUST = { "≤": "<=", "≥": ">=", "√": "raiz", "φ": "phi", "ε": "e", "Σ": "S", "·": "·", "−": "-", "Δ": "D", "γ": "g", "ρ": "rho", "α": "a", "β": "b", "λ": "l" };
function latin(s) { // cadena con códigos 0–255 en cp1252
  let o = "";
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) o += ch;
    else if (CP1252[ch]) o += String.fromCharCode(CP1252[ch]);
    else if (SUST[ch] !== undefined) o += latin(SUST[ch]);
    else o += "?";
  }
  return o;
}
const bytesLatin = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
const utf8 = s => new TextEncoder().encode(s);
function save(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
const slug = s => String(s || "proyecto").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "proyecto";

/* ---------------- ZIP (almacenado, sin compresión) ---------------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) { // files: [{name, data:Uint8Array}]
  const parts = [], central = []; let off = 0;
  const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const nm = utf8(f.name), crc = crc32(f.data), sz = f.data.length;
    const loc = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0)]);
    parts.push(loc, nm, f.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
    off += loc.length + nm.length + sz;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

/* ---------------- XLSX ---------------- */
const xe = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colL = n => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
// estilos: 0 normal, 1 encabezado, 2 moneda, 3 negrita, 4 porcentaje, 5 negrita moneda, 6 título, 7 factor
const ST = { n: 0, h: 1, m: 2, b: 3, p: 4, bm: 5, t: 6, f: 7 };
class Hoja {
  constructor(nombre, anchos = []) { this.nombre = nombre; this.rows = []; this.anchos = anchos; this.freeze = null; }
  set(r, c, v, s = "n") { (this.rows[r] = this.rows[r] || [])[c] = { v, s }; } // r, c base 0; v = número, texto o {f:"..."}
  fila(r, vals, s = "n") { vals.forEach((v, c) => { if (v !== undefined && v !== null && v !== "") this.set(r, c, v, Array.isArray(s) ? s[c] : s); }); }
  xml() {
    let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;
    if (this.freeze) x += `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${this.freeze}" topLeftCell="A${this.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
    if (this.anchos.length) x += `<cols>${this.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
    x += "<sheetData>";
    this.rows.forEach((row, r) => {
      if (!row) return;
      x += `<row r="${r + 1}">`;
      row.forEach((cell, c) => {
        if (!cell) return;
        const ref = colL(c) + (r + 1), s = ST[cell.s] || 0, v = cell.v;
        if (v && typeof v === "object" && "f" in v) x += `<c r="${ref}" s="${s}"><f>${xe(v.f)}</f></c>`;
        else if (typeof v === "number" && isFinite(v)) x += `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
        else x += `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
      });
      x += "</row>";
    });
    return x + "</sheetData></worksheet>";
  }
}
function xlsx(hojas) {
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((h, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((h, i) => `<sheet name="${xe(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  const wbr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((h, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const sty = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="0.0000"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D2328"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="166" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files = [{ name: "[Content_Types].xml", data: utf8(ct) }, { name: "_rels/.rels", data: utf8(rels) }, { name: "xl/workbook.xml", data: utf8(wb) }, { name: "xl/_rels/workbook.xml.rels", data: utf8(wbr) }, { name: "xl/styles.xml", data: utf8(sty) }];
  hojas.forEach((h, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(h.xml()) }));
  return new Blob([zip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ---------------- Dibujo (mm de papel) ---------------- */
const CAPAS = { MARCO: 7, CUADRO: 7, TEXTO: 7, COTAS: 3, EJES: 1, CONCRETO: 7, ACERO: 1, ESTRIBOS: 6, MUROS: 7, OCULTO: 8, NOTAS: 7, SUELO: 8, VENTANAS: 4, PUERTAS: 7, MOBILIARIO: 8, ELECTRICA: 1, HIDRAULICA: 5, AGUA_CALIENTE: 1, SANITARIA: 3 };
const RGB = { 1: [0.75, 0.22, 0.17], 3: [0.18, 0.49, 0.31], 4: [0.0, 0.55, 0.62], 5: [0.12, 0.37, 0.55], 6: [0.56, 0.27, 0.68], 7: [0.11, 0.14, 0.16], 8: [0.54, 0.58, 0.61] };
class Dibujo {
  constructor(w = 900, h = 600) { this.w = w; this.h = h; this.e = []; }
  linea(p1, p2, capa = "CONCRETO", lt = "") { this.e.push({ t: "L", capa, p1, p2, lt }); }
  poli(pts, capa = "CONCRETO", cerrada = false) { const q = cerrada ? [...pts, pts[0]] : pts; for (let i = 0; i < q.length - 1; i++) this.linea(q[i], q[i + 1], capa); }
  rect(x, y, w, h, capa = "CONCRETO") { this.poli([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], capa, true); }
  circ(c, r, capa = "CONCRETO", fill = false) { this.e.push({ t: "C", capa, c, r, fill }); }
  arco(c, r, a0, a1, capa = "PUERTAS") { this.e.push({ t: "A", capa, c, r, a0, a1 }); }
  texto(p, s, h = 2.5, capa = "TEXTO", alin = "izq", rot = 0) { this.e.push({ t: "T", capa, p, s: String(s), h, alin, rot }); }
  cota(p1, p2, txt, off = 6, capa = "COTAS", h = 2) {
    const [x1, y1] = p1, [x2, y2] = p2, sg = off > 0 ? 1 : -1;
    if (Math.abs(y1 - y2) < 1e-6) {
      const y = y1 + off; this.linea([x1, y1], [x1, y + 1.5 * sg], capa); this.linea([x2, y2], [x2, y + 1.5 * sg], capa); this.linea([x1, y], [x2, y], capa);
      for (const x of [x1, x2]) this.linea([x - 1, y - 1], [x + 1, y + 1], capa);
      this.texto([(x1 + x2) / 2, y + 1], txt, h, capa, "centro");
    } else {
      const x = x1 + off; this.linea([x1, y1], [x + 1.5 * sg, y1], capa); this.linea([x2, y2], [x + 1.5 * sg, y2], capa); this.linea([x, y1], [x, y2], capa);
      for (const y of [y1, y2]) this.linea([x - 1, y - 1], [x + 1, y + 1], capa);
      this.texto([off < 0 ? x - 1 : x + 1, (y1 + y2) / 2], txt, h, capa, "centro", 90);
    }
  }
  dxf() {
    const o = []; const g = (c, v) => o.push(String(c), String(v));
    const f = n => Number(n).toFixed(4);
    g(0, "SECTION"); g(2, "HEADER"); g(9, "$ACADVER"); g(1, "AC1009"); g(9, "$INSUNITS"); g(70, 4);
    g(9, "$EXTMIN"); g(10, 0); g(20, 0); g(9, "$EXTMAX"); g(10, this.w); g(20, this.h); g(0, "ENDSEC");
    g(0, "SECTION"); g(2, "TABLES");
    g(0, "TABLE"); g(2, "LTYPE"); g(70, 2);
    g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Solid line"); g(72, 65); g(73, 0); g(40, "0.0");
    g(0, "LTYPE"); g(2, "DASHED"); g(70, 0); g(3, "__ __ __"); g(72, 65); g(73, 2); g(40, "9.0"); g(49, "6.0"); g(49, "-3.0");
    g(0, "ENDTAB");
    g(0, "TABLE"); g(2, "LAYER"); g(70, Object.keys(CAPAS).length + 1);
    g(0, "LAYER"); g(2, "0"); g(70, 0); g(62, 7); g(6, "CONTINUOUS");
    for (const [n, c] of Object.entries(CAPAS)) { g(0, "LAYER"); g(2, n); g(70, 0); g(62, c); g(6, n === "OCULTO" || n === "AGUA_CALIENTE" ? "DASHED" : "CONTINUOUS"); }
    g(0, "ENDTAB");
    g(0, "TABLE"); g(2, "STYLE"); g(70, 1); g(0, "STYLE"); g(2, "STANDARD"); g(70, 0); g(40, "0.0"); g(41, "1.0"); g(50, "0.0"); g(71, 0); g(42, "2.5"); g(3, "txt"); g(4, ""); g(0, "ENDTAB");
    g(0, "ENDSEC"); g(0, "SECTION"); g(2, "ENTITIES");
    for (const e of this.e) {
      if (e.t === "L") { g(0, "LINE"); g(8, e.capa); if (e.lt) g(6, e.lt); g(10, f(e.p1[0])); g(20, f(e.p1[1])); g(30, 0); g(11, f(e.p2[0])); g(21, f(e.p2[1])); g(31, 0); }
      else if (e.t === "C" && e.fill) {
        const r = e.r, [cx, cy] = e.c; g(0, "POLYLINE"); g(8, e.capa); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1); g(40, f(r)); g(41, f(r));
        for (const x of [cx - r / 2, cx + r / 2]) { g(0, "VERTEX"); g(8, e.capa); g(10, f(x)); g(20, f(cy)); g(30, 0); g(42, "1.0"); }
        g(0, "SEQEND"); g(8, e.capa);
      } else if (e.t === "A") { g(0, "ARC"); g(8, e.capa); g(10, f(e.c[0])); g(20, f(e.c[1])); g(30, 0); g(40, f(e.r)); g(50, e.a0); g(51, e.a1); }
      else if (e.t === "C") { g(0, "CIRCLE"); g(8, e.capa); g(10, f(e.c[0])); g(20, f(e.c[1])); g(30, 0); g(40, f(e.r)); }
      else if (e.t === "T") {
        g(0, "TEXT"); g(8, e.capa); g(10, f(e.p[0])); g(20, f(e.p[1])); g(30, 0); g(40, e.h); g(1, latin(e.s.replace(/\n/g, " "))); g(50, e.rot);
        if (e.alin !== "izq") { g(72, e.alin === "centro" ? 1 : 2); g(11, f(e.p[0])); g(21, f(e.p[1])); g(31, 0); }
      }
    }
    g(0, "ENDSEC"); g(0, "EOF");
    return bytesLatin(o.join("\r\n") + "\r\n");
  }
}
// ancho aproximado de Helvetica (fracción de la altura del cuerpo)
const cw = ch => /[0-9]/.test(ch) ? 0.556 : /[ilI.,:;'!|]/.test(ch) ? 0.25 : /[mwMW]/.test(ch) ? 0.85 : /[A-Z]/.test(ch) ? 0.68 : ch === " " ? 0.278 : 0.53;
const anchoTexto = (s, pt) => [...s].reduce((a, c) => a + cw(c), 0) * pt;

/* ---------------- PDF ---------------- */
function pdf(dibujos) {
  const k = 72 / 25.4, objs = [];
  const W = dibujos[0].w * k, H = dibujos[0].h * k;
  const pageIds = [];
  let n = 3; // 1 catálogo, 2 páginas, 3 fuente
  const contents = [];
  for (const d of dibujos) {
    let s = "1 J 1 j\n";
    for (const e of d.e) {
      const col = RGB[CAPAS[e.capa] || 7] || RGB[7], cs = col.map(v => v.toFixed(3)).join(" ");
      if (e.t === "L") {
        const lw = e.capa === "MARCO" ? 0.9 : ["COTAS", "EJES", "OCULTO", "SUELO"].includes(e.capa) ? 0.25 : e.capa === "ESTRIBOS" ? 0.45 : 0.55;
        const dash = e.capa === "OCULTO" || e.capa === "AGUA_CALIENTE" || e.lt === "DASHED" ? "[6 3] 0 d" : e.capa === "EJES" ? "[12 3 2 3] 0 d" : "[] 0 d";
        s += `${cs} RG ${lw} w ${dash} ${(e.p1[0] * k).toFixed(2)} ${(e.p1[1] * k).toFixed(2)} m ${(e.p2[0] * k).toFixed(2)} ${(e.p2[1] * k).toFixed(2)} l S\n`;
      } else if (e.t === "C") {
        const r = e.r * k, x = e.c[0] * k, y = e.c[1] * k, c = 0.5523 * r;
        s += `${cs} RG ${cs} rg 0.4 w [] 0 d ${(x + r).toFixed(2)} ${y.toFixed(2)} m ${(x + r).toFixed(2)} ${(y + c).toFixed(2)} ${(x + c).toFixed(2)} ${(y + r).toFixed(2)} ${x.toFixed(2)} ${(y + r).toFixed(2)} c ${(x - c).toFixed(2)} ${(y + r).toFixed(2)} ${(x - r).toFixed(2)} ${(y + c).toFixed(2)} ${(x - r).toFixed(2)} ${y.toFixed(2)} c ${(x - r).toFixed(2)} ${(y - c).toFixed(2)} ${(x - c).toFixed(2)} ${(y - r).toFixed(2)} ${x.toFixed(2)} ${(y - r).toFixed(2)} c ${(x + c).toFixed(2)} ${(y - r).toFixed(2)} ${(x + r).toFixed(2)} ${(y - c).toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c ${e.fill ? "B" : "S"}\n`;
      } else if (e.t === "A") {
        const n = 16, pts = []; for (let i = 0; i <= n; i++) { const a = (e.a0 + (e.a1 - e.a0) * i / n) * Math.PI / 180; pts.push([(e.c[0] + e.r * Math.cos(a)) * k, (e.c[1] + e.r * Math.sin(a)) * k]); }
        s += `${cs} RG 0.3 w [] 0 d ${pts.map((p, i) => `${p[0].toFixed(2)} ${p[1].toFixed(2)} ${i ? "l" : "m"}`).join(" ")} S\n`;
      } else if (e.t === "T") {
        const pt = e.h * k * 1.38, txt = latin(e.s.replace(/²/g, "2").replace(/³/g, "3")), w = anchoTexto(txt, pt), dx = e.alin === "centro" ? -w / 2 : e.alin === "der" ? -w : 0;
        const a = e.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), x = e.p[0] * k + dx * ca, y = e.p[1] * k + dx * sa;
        const esc = txt.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
        s += `${cs} rg BT /F1 ${pt.toFixed(2)} Tf ${ca.toFixed(4)} ${sa.toFixed(4)} ${(-sa).toFixed(4)} ${ca.toFixed(4)} ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc}) Tj ET\n`;
      }
    }
    contents.push(s);
  }
  const out = []; const offs = []; let len = 0;
  const push = str => { const b = bytesLatin(str); out.push(b); len += b.length; };
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  const kids = dibujos.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  const obj = (id, body) => { offs[id] = len; push(`${id} 0 obj\n${body}\nendobj\n`); };
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${dibujos.length} >>`);
  obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  contents.forEach((c, i) => {
    const pid = 4 + i * 2, cid = pid + 1;
    obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${cid} 0 R >>`);
    obj(cid, `<< /Length ${bytesLatin(c).length} >>\nstream\n${c}endstream`);
  });
  const total = 4 + dibujos.length * 2, xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
  push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(out, { type: "application/pdf" });
}

/* ---------------- detalles (port de vertice/dibujo.py) ---------------- */
class Vista {
  constructor(d, x0, y0, esc) { this.d = d; this.x0 = x0; this.y0 = y0; this.esc = esc; }
  p(x, y) { const f = 10 / this.esc; return [this.x0 + x * f, this.y0 + y * f]; }
  l(v) { return v * 10 / this.esc; }
  linea(a, b, capa, lt) { this.d.linea(this.p(...a), this.p(...b), capa, lt); }
  rect(x, y, w, h, capa = "CONCRETO") { this.d.poli([this.p(x, y), this.p(x + w, y), this.p(x + w, y + h), this.p(x, y + h)], capa, true); }
  varilla(x, y, num) { this.d.circ(this.p(x, y), Math.max(this.l(VAR[num][0] / 2), 0.45), "ACERO", true); }
  cota(a, b, t, off) { this.d.cota(this.p(...a), this.p(...b), t, off); }
  titulo(x, y, t, esc = true) { const [px, py] = this.p(x, y); this.d.texto([px, py], t, 3.5, "TEXTO", "centro"); this.d.linea([px - t.length * 1.6, py - 1.5], [px + t.length * 1.6, py - 1.5], "TEXTO"); if (esc) this.d.texto([px, py - 6], `ESC. 1:${this.esc}`, 2.2, "TEXTO", "centro"); }
}
function envolver(t, n) { const o = []; let a = ""; for (const p of String(t).split(/\s+/)) { if (a.length + p.length + 1 > n) { o.push(a); a = p; } else a = (a + " " + p).trim(); } if (a) o.push(a); return o.length ? o : [""]; }
const NOTAS = [
  "Cotas en cm, niveles en m. Las cotas rigen sobre el dibujo; verificar en obra contra planos arquitectónicos.",
  "Concreto f'c indicado en cada elemento; agregado máximo 3/4\". Revenimiento según especificación.",
  "Acero de refuerzo NMX-B-506 / ASTM A615 grado 42 (fy = 4200 kg/cm²).",
  "Recubrimientos libres: zapatas 7.5 cm, columnas y trabes 4 cm, losas 2.5 cm.",
  "Traslapes clase B según tabla; no traslapar más del 50 % del acero en una misma sección.",
  "Ganchos estándar a 90° y 135° en estribos según ACI 318-19 cap. 25.",
  "Capacidad de carga del terreno según estudio de mecánica de suelos; si no existe, el valor usado es un supuesto a validar.",
  "Diseño conforme al reglamento de edificación del municipio, NTC y MDOC-CFE Sismo; ACI 318-19 como referencia.",
];
function hoja(dp) {
  const d = new Dibujo(900, 600), m = 10, W = 900, H = 600;
  d.rect(m, m, W - 2 * m, H - 2 * m, "MARCO");
  const xc = W - m - 175, x = xc + 6; d.linea([xc, m], [xc, H - m], "MARCO");
  let y = H - m - 22;
  d.texto([x, y], "VÉRTICE", 9, "CUADRO"); d.texto([x, y - 7], "Ingeniería, Arquitectura y Proyectos", 3.2, "CUADRO"); d.texto([x, y - 12.5], "Tijuana, Baja California", 2.4, "CUADRO");
  y -= 20; d.linea([xc, y], [W - m, y], "CUADRO");
  let yn = y - 7; d.texto([x, yn], "NOTAS GENERALES", 3, "NOTAS"); yn -= 6;
  for (const nota of dp.notas) { for (const ln of envolver(nota, 62)) { d.texto([x, yn], ln, 2.1, "NOTAS"); yn -= 3.6; } yn -= 1.2; }
  const yb = m + 118; d.linea([xc, yb], [W - m, yb], "CUADRO"); let yy = yb - 3;
  for (const [et, val] of [["PROYECTO", dp.proyecto], ["UBICACIÓN", dp.ubicacion], ["PROPIETARIO", dp.propietario], ["CONTENIDO", dp.contenido]]) {
    d.texto([x, yy - 3], et, 1.8, "CUADRO"); envolver(val || "", 48).slice(0, 2).forEach((ln, i) => d.texto([x, yy - 7.5 - i * 4], ln, 2.8, "CUADRO"));
    yy -= 16; d.linea([xc, yy], [W - m, yy], "CUADRO");
  }
  const celdas = [["CLAVE", dp.clave, 7], ["ESCALA", "Indicadas", 3], ["FECHA", dp.fecha, 3], ["REV.", dp.rev, 3]], cw2 = 175 / 4;
  celdas.forEach(([et, v, h], i) => { const cx = xc + i * cw2; if (i) d.linea([cx, m + 30], [cx, yy], "CUADRO"); d.texto([cx + 3, yy - 4], et, 1.8, "CUADRO"); d.texto([cx + 3, m + 34], v, h, "CUADRO"); });
  d.linea([xc, m + 30], [W - m, m + 30], "CUADRO");
  d.texto([x, m + 24], `ELABORÓ: ${dp.elab}`, 2.2, "CUADRO"); d.texto([x, m + 18], `DRO / CORRESPONSABLE: ${dp.dro}`, 2.2, "CUADRO");
  d.texto([x, m + 9], "FIRMA: ______________________________", 2.4, "CUADRO"); d.texto([x, m + 3.5], LEY.toUpperCase(), 1.9, "CUADRO");
  return d;
}
function seccion(d, x0, y0, esc, nombre, b, h, rec, sup, inf, est, sepTxt, fc, lat) {
  const v = new Vista(d, x0, y0, esc), de = VAR[est][0];
  v.rect(0, 0, b, h); v.rect(rec, rec, b - 2 * rec, h - 2 * rec, "ESTRIBOS");
  v.linea([rec, h - rec], [rec + 4, h - rec - 4], "ESTRIBOS"); v.linea([rec + 1.2, h - rec], [rec + 5.2, h - rec - 4], "ESTRIBOS");
  const fila = (barras, y) => { const l = []; barras.forEach(([n, num]) => { for (let i = 0; i < n; i++) l.push(num); }); if (!l.length) return; const dm = Math.max(...l.map(q => VAR[q][0])), xa = rec + de + dm / 2, xb = b - rec - de - dm / 2; l.forEach((num, i) => v.varilla(l.length === 1 ? xa : xa + (xb - xa) * i / (l.length - 1), y, num)); };
  const ds = Math.max(0, ...sup.map(q => VAR[q[1]][0])), di = Math.max(0, ...inf.map(q => VAR[q[1]][0]));
  fila(sup, h - rec - de - ds / 2); fila(inf, rec + de + di / 2);
  if (lat) { const [n, num] = lat; for (let i = 1; i <= n; i++) { const y = rec + (h - 2 * rec) * i / (n + 1); v.varilla(rec + de + VAR[num][0] / 2, y, num); v.varilla(b - rec - de - VAR[num][0] / 2, y, num); } }
  v.cota([0, 0], [b, 0], `${b}`, -6); v.cota([b, 0], [b, h], `${h}`, 6);
  v.titulo(b / 2, -16 * esc / 10, nombre);
  const [tx, ty] = v.p(b, h), ls = [];
  if (sup.length) ls.push("Sup.: " + sup.map(([n, q]) => `${n}#${q}`).join(" + "));
  if (inf.length) ls.push("Inf.: " + inf.map(([n, q]) => `${n}#${q}`).join(" + "));
  if (lat) ls.push(`Lat.: ${lat[0] * 2}#${lat[1]}`);
  ls.push(`E#${est} ${sepTxt}`); ls.push(`f'c = ${fc} kg/cm²`);
  ls.forEach((s, i) => d.texto([tx + 10, ty - 3 - i * 4.2], s, 2.4));
}
function elevacion(d, x0, y0, esc, nombre, L, h, apoyo, sup, inf, est, sc, sm) {
  const v = new Vista(d, x0, y0, esc), zc = 2 * h, rec = 4;
  v.rect(-apoyo, 0, apoyo, h, "OCULTO"); v.rect(L, 0, apoyo, h, "OCULTO"); v.linea([0, 0], [L, 0]); v.linea([0, h], [L, h]);
  v.linea([-apoyo + rec, h - rec], [L + apoyo - rec, h - rec], "ACERO"); v.linea([-apoyo + rec, rec], [L + apoyo - rec, rec], "ACERO");
  v.linea([-apoyo + rec, h - rec], [-apoyo + rec, h - rec - 15], "ACERO"); v.linea([L + apoyo - rec, h - rec], [L + apoyo - rec, h - rec - 15], "ACERO");
  let x = 5; while (x <= L - 5 + 1e-6) { v.linea([x, rec - 1], [x, h - rec + 1], "ESTRIBOS"); x += (x < zc || x > L - zc) ? sc : sm; }
  v.cota([0, 0], [zc, 0], `${zc}`, -6); v.cota([L - zc, 0], [L, 0], `${zc}`, -6); v.cota([0, 0], [L, 0], `${L}`, -13);
  v.titulo(L / 2, -26 * esc / 10, nombre);
  const [px, py] = v.p(0, h);
  d.texto([px, py + 6], `Sup.: ${sup.map(([n, q]) => `${n}#${q}`).join(" + ")} corridas · Inf.: ${inf.map(([n, q]) => `${n}#${q}`).join(" + ")}`, 2.4);
  d.texto([px, py + 11], `E#${est}: 1a @ 5 cm, resto @ ${sc} cm en ${zc} cm de cada extremo; centro @ ${sm} cm`, 2.4);
}
function zapataDet(d, x0, y0, esc, nombre, B, L, h, c1, c2, armado, Df, num) {
  const v = new Vista(d, x0, y0, esc);
  v.rect(0, 0, B, L); v.rect((B - c1) / 2, (L - c2) / 2, c1, c2);
  for (let i = 1; i < 8; i++) { v.linea([B * i / 8, 7.5], [B * i / 8, L - 7.5], "ACERO"); v.linea([7.5, L * i / 8], [B - 7.5, L * i / 8], "ACERO"); }
  v.cota([0, 0], [B, 0], `${B}`, -6); v.cota([B, 0], [B, L], `${L}`, 6); v.titulo(B / 2, -16 * esc / 10, `${nombre} — PLANTA`);
  const xc = B + 70; v.rect(xc, 0, B, h); v.rect(xc + (B - c1) / 2, h, c1, Df - h); v.rect(xc - 10, -5, B + 20, 5, "SUELO");
  v.linea([xc + 7.5, 7.5], [xc + B - 7.5, 7.5], "ACERO"); for (let i = 0; i < 9; i++) v.varilla(xc + 7.5 + (B - 15) * i / 8, 9.5, num);
  v.linea([xc - 30, Df], [xc + B + 30, Df], "SUELO"); v.cota([xc, 0], [xc, h], `${h}`, -6); v.cota([xc + B, 0], [xc + B, Df], `Df=${Df}`, 8);
  v.titulo(xc + B / 2, -16 * esc / 10, `${nombre} — CORTE`);
  const [px, py] = v.p(xc, Df); d.texto([px, py + 5], `Parrilla: ${armado}`, 2.4); d.texto([px, py + 9.5], "Plantilla f'c=100 kg/cm² de 5 cm · recubrimiento 7.5 cm", 2.4);
}
function tabla(d, x, y, enc, filas, anchos, titulo, hf = 6) {
  if (titulo) d.texto([x, y + 3], titulo, 3); const Wt = anchos.reduce((a, b) => a + b, 0), n = filas.length + 1;
  d.rect(x, y - n * hf, Wt, n * hf, "TEXTO"); for (let i = 1; i < n; i++) d.linea([x, y - i * hf], [x + Wt, y - i * hf], "TEXTO");
  let cx = x; anchos.slice(0, -1).forEach(a => { cx += a; d.linea([cx, y], [cx, y - n * hf], "TEXTO"); });
  [enc, ...filas].forEach((f, r) => { let c = x; anchos.forEach((a, j) => { d.texto([c + 1.5, y - r * hf - hf + 1.8], f[j] ?? "", r ? 2.2 : 2.3); c += a; }); });
}
function ejes(d, x0, y0, esc, ex, ey, nx, ny, ext = 150) {
  const v = new Vista(d, x0, y0, esc), Y1 = ey[ey.length - 1], X1 = ex[ex.length - 1];
  ex.forEach((x, i) => { v.linea([x, -ext], [x, Y1 + ext], "EJES"); const [cx, cy] = v.p(x, Y1 + ext); d.circ([cx, cy + 4], 4, "EJES"); d.texto([cx, cy + 3], nx[i] || String(i + 1), 3, "EJES", "centro"); });
  ey.forEach((y, i) => { v.linea([-ext, y], [X1 + ext, y], "EJES"); const [cx, cy] = v.p(-ext, y); d.circ([cx - 4, cy], 4, "EJES"); d.texto([cx - 4, cy - 1.2], ny[i] || String.fromCharCode(65 + i), 3, "EJES", "centro"); });
  for (let i = 1; i < ex.length; i++) v.cota([ex[i - 1], Y1 + ext * 0.9], [ex[i], Y1 + ext * 0.9], `${ex[i] - ex[i - 1]}`, 0);
  for (let i = 1; i < ey.length; i++) v.cota([X1 + ext * 0.9, ey[i - 1]], [X1 + ext * 0.9, ey[i]], `${ey[i] - ey[i - 1]}`, 0);
  return v;
}
const ld = (num, fc = 250, fy = 4200) => Math.max(30, fy / ((num <= 6 ? 6.7 : 5.4) * Math.sqrt(fc)) * VAR[num][0]);
const gancho = (num, fc = 250, fy = 4200) => Math.max(8 * VAR[num][0], 15, 0.075 * fy * VAR[num][0] / Math.sqrt(fc));
const escala = (need, lim, op = [5, 10, 15, 20, 25, 40, 50, 75, 100, 125, 150, 200, 250]) => op.find(e => need * 10 / e <= lim) || op[op.length - 1];

/* ---------------- datos del proyecto ---------------- */
function DP() {
  const g = k => { const e = document.getElementById("entregables-" + k); return e ? e.value : ""; };
  const nums = s => String(s).split(/[,;\s]+/).map(Number).filter(v => isFinite(v));
  const ex = nums(g("ejx")), ey = nums(g("ejy"));
  return { proyecto: g("proy"), ubicacion: g("ubic"), propietario: g("prop"), elab: g("elab"), dro: g("dro"), rev: g("rev") || "0",
    fecha: new Date().toLocaleDateString("es-MX"), ex: ex.length >= 2 ? ex : [0, 400, 800], ey: ey.length >= 2 ? ey : [0, 500, 1000],
    nx: g("nomx").split(/[,;]+/).map(s => s.trim()), ny: g("nomy").split(/[,;]+/).map(s => s.trim()) };
}
function supuestos() { return ($("#e-sup").value || "").split(/\n/).map(l => l.split("|").map(s => s.trim())).filter(r => r[0]); }
function supuestosAuto() {
  const o = [];
  if (RES.zapata) o.push([`Capacidad admisible del terreno`, `${RES.zapata.qadm} t/m²`, "Cambia dimensiones de zapatas; confirmar con EMS"]);
  if (RES.sismo && !/PRODISIS/.test(RES.sismo.orig)) o.push(["Espectro sísmico paramétrico (no PRODISIS)", "a0, c, Ta, Tb, k, r capturados", "Cambia cortante basal; usar PRODISIS del sitio"]);
  if (RES.muros) o.push(["Resistencia v*m de la mampostería", `${RES.muros.vm} kg/cm²`, "Cambia la capacidad de muros; confirmar con pruebas"]);
  o.push(["Elementos mecánicos de trabe y columna", "Capturados por el ingeniero", "Deben provenir del análisis estructural del proyecto"]);
  return o;
}

/* ---------------- planos ---------------- */
function planos() {
  const dp = DP(), t = RES.trabe, c = RES.columna, z = RES.zapata;
  const base = { proyecto: dp.proyecto, ubicacion: dp.ubicacion, propietario: dp.propietario, fecha: dp.fecha, rev: dp.rev, elab: dp.elab, dro: dp.dro };
  // E-01
  const h1 = hoja({ ...base, contenido: "Planta de cimentación y detalles", clave: "E-01", notas: [...NOTAS, z ? `q adm usada = ${z.qadm} t/m² (validar con EMS).` : ""] });
  const X1 = dp.ex[dp.ex.length - 1], Y1 = dp.ey[dp.ey.length - 1], e1 = escala(Math.max(X1 + 300, (Y1 + 300) * 330 / 400), 330, [25, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500]);
  const v = ejes(h1, 70, 140, e1, dp.ex, dp.ey, dp.nx, dp.ny);
  if (z) for (const x of dp.ex) for (const y of dp.ey) { v.rect(x - z.z.B / 2, y - z.z.L / 2, z.z.B, z.z.L); v.rect(x - z.c1 / 2, y - z.c2 / 2, z.c1, z.c2); const [px, py] = v.p(x + z.z.B / 2, y + z.z.L / 2); h1.texto([px + 1.5, py + 1.5], "Z-1", 2.6); }
  for (let i = 1; i < dp.ex.length; i++) for (const y of dp.ey) { v.linea([dp.ex[i - 1] + (z ? z.z.B / 2 : 0), y - 12.5], [dp.ex[i] - (z ? z.z.B / 2 : 0), y - 12.5], "OCULTO"); v.linea([dp.ex[i - 1] + (z ? z.z.B / 2 : 0), y + 12.5], [dp.ex[i] - (z ? z.z.B / 2 : 0), y + 12.5], "OCULTO"); }
  for (let i = 1; i < dp.ey.length; i++) for (const x of dp.ex) { v.linea([x - 12.5, dp.ey[i - 1] + (z ? z.z.L / 2 : 0)], [x - 12.5, dp.ey[i] - (z ? z.z.L / 2 : 0)], "OCULTO"); v.linea([x + 12.5, dp.ey[i - 1] + (z ? z.z.L / 2 : 0)], [x + 12.5, dp.ey[i] - (z ? z.z.L / 2 : 0)], "OCULTO"); }
  v.titulo(X1 / 2, -150 - 120 * e1 / 50, "PLANTA DE CIMENTACIÓN");
  if (z) {
    const ez = escala(2 * z.z.B + 70, 190, [10, 15, 20, 25, 40, 50]);
    zapataDet(h1, 440, 420, ez, "Z-1", z.z.B, z.z.L, z.z.h, z.c1, z.c2, `#${z.num} @ ${z.z.s} cm ambos sentidos (${z.z.n} vars por sentido)`, Math.round(z.Df * 100), z.num);
  } else h1.texto([440, 480], "Sin zapata calculada: captura la pestaña Zapata.", 3);
  const filasC = [];
  if (z) filasC.push(["Z-1", `${z.z.B} × ${z.z.L} × ${z.z.h}`, `#${z.num} @ ${z.z.s} cm ambos sentidos`, `${z.fc}`]);
  if (c) filasC.push(["C-1", `${c.b} × ${c.h}`, `${c.nbar}#${c.num}, E#${c.est} @ ${c.s} (@ 10 en extremos)`, `${c.fc}`]);
  filasC.push(["CT-1", "25 × 50", "Contratrabe de liga: definir con el análisis", "250"]);
  tabla(h1, 440, 330, ["Elemento", "Dimensiones (cm)", "Armado", "f'c"], filasC, [22, 40, 110, 14], "CUADRO DE CIMENTACIÓN");
  tabla(h1, 440, 265, ["Varilla", "ld (cm)", "Traslape (cm)", "Gancho (cm)"], [3, 4, 5, 6, 8].map(n => [`#${n}`, ld(n).toFixed(0), (Math.max(30, 1.3 * ld(n))).toFixed(0), gancho(n).toFixed(0)]), [25, 25, 30, 30], "LONGITUDES DE DESARROLLO (f'c 250, fy 4200)");
  // E-02
  const h2 = hoja({ ...base, contenido: "Trabes y columnas", clave: "E-02", notas: NOTAS });
  if (t && t.pr) {
    const sup = [[2, Math.min(t.pr.num, 4)]], inf = [[t.pr.n, t.pr.num]], es = escala(t.h, 120, [5, 10, 15, 20]);
    seccion(h2, 70, 600 - 70 - t.h * 10 / es - 40, es, "T-1 SECCIÓN", t.b, t.h, t.rec, sup, inf, t.est, `@ ${t.co.s}`, t.fc);
    const L = t.L || 500, el = escala(L + 60, 400, [10, 20, 25, 40, 50, 75, 100]);
    elevacion(h2, 90, 210, el, "T-1 ELEVACIÓN", L, t.h, 30, sup, inf, t.est, Math.min(10, t.co.s), Math.min(t.co.s, 20));
  } else h2.texto([70, 500], "Trabe sin armado válido: revisa la pestaña Trabe.", 3);
  if (c) {
    const es = escala(Math.max(c.b, c.h), 100, [5, 10, 15, 20]), nb = c.nb, latN = Math.max(0, c.nh - 2);
    seccion(h2, 300, 600 - 70 - c.h * 10 / es - 40, es, "C-1 SECCIÓN", c.b, c.h, c.rec, [[nb, c.num]], [[nb, c.num]], c.est, `@ ${c.s} (@10 en extremos)`, c.fc, latN ? [latN, c.num] : null);
  }
  const filasT = [];
  if (t && t.pr) filasT.push(["T-1", `${t.b} × ${t.h}`, `Inf. ${t.pr.n}#${t.pr.num}, sup. 2#${Math.min(t.pr.num, 4)}`, `E#${t.est} @ ${t.co.s}; @ 10 en ${2 * t.h} cm extremos`, `${t.fc}`]);
  if (c) filasT.push(["C-1", `${c.b} × ${c.h}`, `${c.nbar}#${c.num}`, `E#${c.est} @ ${c.s}; @ 10 en extremos`, `${c.fc}`]);
  tabla(h2, 70, 120, ["Elemento", "Sección (cm)", "Longitudinal", "Transversal", "f'c"], filasT, [22, 28, 60, 80, 14], "CUADRO DE TRABES Y COLUMNAS");
  const extra = window.VC_ARQ ? window.VC_ARQ.hojas({ ...base }) : [];
  return { h1, h2, dp, extra };
}

/* ---------------- Excel ---------------- */
function excel() {
  const P = typeof LAST_PR !== "undefined" ? LAST_PR : null, G = typeof LAST_PG !== "undefined" ? LAST_PG : null, dp = DP(), hojas = [];
  if (P) {
    const so = new Hoja("Sobrecosto", [34, 14]);
    so.fila(0, ["Concepto", "Valor"], "h");
    [["Indirectos %", P.g.ind], ["Financiamiento %", P.g.fin], ["Utilidad %", P.g.uti], ["IVA %", P.g.iva], ["Ajuste de materiales a Tijuana % (ya aplicado en APU)", P.g.reg]].forEach((r, i) => so.fila(i + 1, r));
    so.set(7, 0, "Factor de sobrecosto", "b"); so.set(7, 1, { f: "(1+B2/100)*(1+B3/100)*(1+B4/100)" }, "f");
    const ap = new Hoja("APU", [14, 56, 9, 12, 14, 15, 70]); let r = 0; const cdRef = {};
    const rows = P.rows.filter(x => x.a);
    rows.forEach((x, i) => {
      const cl = String(i + 1).padStart(3, "0"), a = x.a;
      ap.fila(r, [cl, a.r.concepto, "", "", a.r.unidad], "b"); r++;
      ap.fila(r, ["Tipo", "Insumo", "Unidad", "Cantidad", "Precio", "Importe", "Fuente"], "h"); r++;
      const first = r + 1;
      a.lines.forEach(l => { ap.fila(r, [l.t, l.d, l.u, +l.c.toFixed(6), +l.p.toFixed(2), { f: `D${r + 1}*E${r + 1}` }, l.f], ["n", "n", "n", "n", "m", "m", "n"]); r++; });
      const last = r;
      ap.fila(r, ["Herramienta", "Herramienta menor (3 % de M.O.)", "%", 0.03, { f: `SUMIF(A${first}:A${last},"Mano de obra",F${first}:F${last})` }, { f: `D${r + 1}*E${r + 1}` }], ["n", "n", "n", "n", "m", "m"]); r++;
      ap.set(r, 4, "Costo directo", "b"); ap.set(r, 5, { f: `SUM(F${first}:F${r})` }, "bm"); cdRef[i] = `APU!F${r + 1}`; r += 2;
    });
    const ca = new Hoja("Catálogo", [16, 9, 60, 8, 11, 15, 15, 17]); ca.freeze = 4;
    ca.set(0, 0, `Presupuesto — ${P.g.proy || dp.proyecto}`, "t"); ca.set(1, 0, `${dp.ubicacion} · Vértice Ingeniería, Arquitectura y Proyectos · ${dp.fecha}`);
    ca.fila(3, ["Partida", "Clave", "Concepto", "Unidad", "Cantidad", "Costo directo", "P.U.", "Importe"], "h");
    rows.forEach((x, i) => { const rr = 4 + i, R = rr + 1; ca.fila(rr, [x.a.r.partida, String(i + 1).padStart(3, "0"), x.a.r.concepto, x.a.r.unidad, x.q, { f: cdRef[i] }, { f: `ROUND(F${R}*Sobrecosto!$B$8,2)` }, { f: `E${R}*G${R}` }], ["n", "n", "n", "n", "n", "m", "m", "m"]); });
    const r0 = 5, rl = 4 + rows.length, t = rl + 2;
    ca.fila(t - 1, [, , , , , , "Subtotal", { f: `SUM(H${r0}:H${rl})` }], ["n", "n", "n", "n", "n", "n", "b", "bm"]);
    ca.fila(t, [, , , , , , "IVA", { f: `H${t}*Sobrecosto!B5/100` }], ["n", "n", "n", "n", "n", "n", "b", "bm"]);
    ca.fila(t + 1, [, , , , , , "Total", { f: `H${t}+H${t + 1}` }], ["n", "n", "n", "n", "n", "n", "b", "bm"]);
    const rs = new Hoja("Resumen", [30, 18, 12, 16]);
    rs.set(0, 0, `Resumen por partida — ${P.g.proy || dp.proyecto}`, "t"); rs.fila(2, ["Partida", "Importe sin IVA", "% del total", "Costo por m²"], "h");
    const parts = [...new Set(rows.map(x => x.a.r.partida))], tr = 3 + parts.length, A = P.area || 0;
    parts.forEach((p, i) => { const R = 4 + i; rs.fila(3 + i, [p, { f: `SUMIF('Catálogo'!A${r0}:A${rl},A${R},'Catálogo'!H${r0}:H${rl})` }, { f: `B${R}/B${tr + 1}` }, { f: A > 0 ? `B${R}/${A}` : "0" }], ["n", "m", "p", "m"]); });
    rs.fila(tr, ["Total sin IVA", { f: `SUM(B4:B${tr})` }, "", { f: A > 0 ? `B${tr + 1}/${A}` : "0" }], ["b", "bm", "n", "bm"]);
    rs.fila(tr + 1, ["Total con IVA", { f: `B${tr + 1}*(1+Sobrecosto!B5/100)` }], ["b", "bm"]);
    rs.set(tr + 3, 0, "Precios de referencia (Precios de Obra MX + FSR 2026). Sustituir por cotizaciones antes de contratar. " + LEY + ".");
    hojas.push(rs, ca, ap, so);
  }
  if (G) {
    const pg = new Hoja("Programa", [8, 40, 10, 14, 10, 10, 10, 10, 10, 8, 15]); pg.freeze = 1;
    pg.fila(0, ["ID", "Actividad", "Duración (días)", "Predecesoras", "Inicio temprano", "Fin temprano", "Inicio tardío", "Fin tardío", "Holgura", "Crítica", "Costo"], "h");
    G.acts.slice().sort((a, b) => a.IC - b.IC || a.id.localeCompare(b.id)).forEach((a, i) => { const R = i + 2; pg.fila(i + 1, [a.id, a.nom, a.dur, a.pred.join(", "), a.IC, a.TC, a.IL, a.TL, { f: `G${R}-E${R}` }, a.crit ? "Sí" : "", a.costo], ["n", "n", "n", "n", "n", "n", "n", "n", "n", "n", "m"]); });
    const fl = new Hoja("Flujo de caja", [9, 17, 15, 15, 15, 16]); fl.freeze = 1;
    fl.fila(0, ["Semana", "Costo programado", "Ingresos", "Egresos", "Saldo", "Acumulado"], "h");
    G.F.f.forEach((x, i) => { const R = i + 2; fl.fila(i + 1, [x.w, +x.prog.toFixed(2), +x.ing.toFixed(2), +x.egr.toFixed(2), { f: `C${R}-D${R}` }, { f: i ? `F${R - 1}+E${R}` : `E${R}` }], ["n", "m", "m", "m", "m", "m"]); });
    const r = G.F.f.length + 3;
    [["Monto del contrato", G.monto], ["Anticipo %", G.pg.ant * 100], ["Fondo de garantía %", G.pg.ret * 100], ["Necesidad máxima de financiamiento", G.F.fin], ["Costo del financiamiento", G.F.cf], ["Margen bruto", G.F.util]].forEach((q, i) => fl.fila(r + i, q, ["b", i === 1 || i === 2 ? "n" : "m"]));
    hojas.push(pg, fl);
  }
  if (!hojas.length) throw new Error("Captura el presupuesto o el programa antes de generar el Excel.");
  return xlsx(hojas);
}

/* ---------------- Word ---------------- */
function cargarDocx() {
  if (window.docx) return Promise.resolve(window.docx);
  return new Promise((ok, no) => { const s = document.createElement("script"); s.src = "vendor/docx-9.7.1.iife.js"; s.onload = () => ok(window.docx); s.onerror = () => no(new Error("No se pudo cargar el generador de Word")); document.head.appendChild(s); });
}
async function memoria() {
  const D = await cargarDocx(), dp = DP(), t = RES.trabe, c = RES.columna, z = RES.zapata, m = RES.muros, s = RES.sismo;
  const { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, Header, Footer, PageBreak, AlignmentType, ShadingType } = D;
  const kids = [];
  const P = (txt, o = {}) => kids.push(new Paragraph({ children: [new TextRun({ text: String(txt), ...o })], spacing: { after: 100 } }));
  const Hd = (txt, l = 1) => kids.push(new Paragraph({ text: txt, heading: l === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }));
  const F = (txt, ref) => kids.push(new Paragraph({ children: [new TextRun({ text: txt, font: "Consolas", size: 19 }), ...(ref ? [new TextRun({ text: `    [${ref}]`, italics: true, size: 16, color: "5B656E" })] : [])], spacing: { after: 80 } }));
  const T = (enc, filas) => {
    const cell = (v, h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v ?? ""), bold: !!h, color: h ? "FFFFFF" : undefined, size: 19 })] })], shading: h ? { type: ShadingType.CLEAR, fill: "1D2328", color: "auto" } : undefined });
    kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: enc.map(v => cell(v, true)) }), ...filas.map(f => new TableRow({ children: f.map(v => cell(v)) }))] }));
    kids.push(new Paragraph({ text: "" }));
  };
  const n2 = (v, d = 2) => nf(v, d);
  // portada
  kids.push(new Paragraph({ children: [new TextRun({ text: "VÉRTICE", bold: true, size: 64, color: "1D2328" })] }));
  P("Ingeniería, Arquitectura y Proyectos · Tijuana, Baja California");
  kids.push(new Paragraph({ text: "" }));
  kids.push(new Paragraph({ children: [new TextRun({ text: "MEMORIA DE CÁLCULO ESTRUCTURAL", bold: true, size: 36 })] }));
  [["Proyecto", dp.proyecto], ["Ubicación", dp.ubicacion], ["Propietario", dp.propietario], ["Fecha", dp.fecha], ["Revisión", dp.rev], ["Elaboró", dp.elab]].forEach(([k, v]) => v && P(`${k}: ${v}`));
  kids.push(new Paragraph({ text: "" })); P(LEY.toUpperCase(), { bold: true, color: "B23B2E" });
  kids.push(new Paragraph({ children: [new PageBreak()] }));
  Hd("Supuestos a validar");
  T(["Supuesto", "Valor usado", "Impacto si cambia"], [...supuestos(), ...supuestosAuto()]);
  Hd("1. Datos generales y normativa aplicada");
  T(["Norma", "Ámbito"], [["Ley de Edificaciones del Estado de Baja California y su reglamento", "Estatal"], ["Reglamento de Edificación del municipio del predio", "Municipal"], ["Normas Técnicas Complementarias (Criterios y Acciones, Concreto, Mampostería, Cimentaciones, Sismo)", "Referencia adoptada"], ["Manual de Diseño de Obras Civiles CFE — Diseño por Sismo (PRODISIS) y por Viento", "Acciones"], ["ACI 318-19", "Concreto (apoyo)"], ["NMX-B-506 / ASTM A615; ASTM C39, C31, C94", "Materiales y pruebas"]]);
  Hd("2. Materiales");
  T(["Material", "Valor"], [["Concreto estructural f'c", `${t ? t.fc : 250} kg/cm²`], ["Módulo de elasticidad Ec = 15100√f'c", `${n2(15100 * Math.sqrt(t ? t.fc : 250), 0)} kg/cm²`], ["Acero de refuerzo fy", `${t ? t.fy : 4200} kg/cm²`], ...(m ? [["Mampostería v*m", `${m.vm} kg/cm²`]] : [])]);
  if (s) {
    Hd("3. Análisis sísmico (método estático)");
    P(`Espectro: ${s.orig}. Q = ${s.par.Q}, R0 = ${s.par.R0}, ρ = ${s.par.rho}, α = ${s.par.alfa}.`);
    F(`T = ${n2(s.R.T, 3)} s · c/(Q'R) = ${n2(s.R.c, 4)} · W = ${n2(s.R.W)} t · Vbase = ${n2(s.R.V)} t`, "MDOC-CFE Sismo 2015");
    T(["Nivel", "W (t)", "z (m)", "Fi (t)", "Vi (t)", "Distorsión"], s.niv.map((v, i) => [v.n, n2(v.W), v.z, n2(s.R.F[i]), n2(s.R.Vi[i]), s.R.dist ? `${n2(s.R.dist[i].g, 4)} (lím. ${s.lim})` : "—"]));
  }
  if (m) {
    Hd("4. Muros de mampostería confinada (método simplificado)");
    F(`Vu = FC·c·W = ${m.FC} × ${m.cs} × ${m.W} t = ${n2(m.Vu / 1000)} t`, "NTC Mampostería");
    F("VmR = FR(0.5·v*m·AT + 0.3P) ≤ 1.5·FR·v*m·AT, FR = 0.7; FAE = 1 si H/L ≤ 1.33", "NTC Mampostería");
    T(["Eje", "Dir.", "L (cm)", "t (cm)", "H (cm)", "FAE", "VmR (t)"], m.muros.map(w => [w.eje, w.dir, w.L, w.t, w.H, n2(w.FAE, 3), n2(w.VmR / 1000)]));
    T(["Dirección", "ΣFAE·VmR (t)", "Vu (t)", "D/C", "Resultado"], m.res.map(r => [r.dir, n2(r.VR / 1000), n2(m.Vu / 1000), n2(m.Vu / r.VR), r.ok ? "Cumple" : "NO CUMPLE"]));
  }
  Hd("5. Diseño de elementos");
  if (t) {
    Hd(`Trabe T-1 (${t.b} × ${t.h} cm)`, 2);
    F(`Mu = ${t.Mu} t·m, Vu = ${t.Vu} t (elementos mecánicos últimos capturados), d = ${n2(t.d, 1)} cm`);
    F(`Rn = Mu/(φbd²); ρ = 0.85f'c/fy(1−√(1−2Rn/0.85f'c)) → As req = ${n2(t.fl.Asr)} cm²`, "ACI 318-19 22.2");
    F(`As mín = ${n2(t.fl.Asmin)} cm², As máx (εt=0.005) = ${n2(t.fl.Asmax)} cm², εt = ${n2(t.fl.et, 4)}, φ = ${n2(t.fl.phi, 3)}`, "ACI 9.6.1.2, 21.2.2");
    F(`Armado: ${t.pr ? `${t.pr.n} #${t.pr.num} inferior (As = ${n2(t.pr.As)} cm²), 2 #${Math.min(t.pr.num, 4)} superior` : "no cabe en una capa"}; φMn = ${n2(t.fl.phiMn / 1e5)} t·m`);
    F(`Vc = 0.53√f'c·b·d = ${n2(t.co.Vc / 1000)} t; Vs = ${n2(t.co.Vs / 1000)} t; s req = ${isFinite(t.co.sreq) ? n2(t.co.sreq, 1) : "—"} cm, s máx = ${n2(t.co.smax, 1)} cm → E#${t.est} @ ${t.co.s} cm; φVn = ${n2(t.co.phiVn / 1000)} t`, "ACI 22.5, 9.7.6");
    P(`Resultado: ${t.ok ? "CUMPLE" : "NO CUMPLE"}`, { bold: true, color: t.ok ? "2E7D4F" : "B23B2E" });
  }
  if (c) {
    Hd(`Columna C-1 (${c.b} × ${c.h} cm, ${c.nbar} #${c.num})`, 2);
    F(`Pu = ${c.Pu} t, Mu = ${c.Mu} t·m; ρ = ${n2(c.r.rho * 100)} %; φPn,max = ${n2(c.r.Pmax / 1000, 1)} t`, "ACI 22.4.2.1, 10.6.1.1");
    F(`φMn a Pu = ${n2(c.r.phiMn / 1e5)} t·m (diagrama por compatibilidad de deformaciones); D/C = ${n2(c.r.DC)}`, "ACI 22.2, 21.2.2");
    F(`Estribos E#${c.est} @ ${c.s} cm, @ 10 cm en zonas de confinamiento`, "ACI 25.7.2.1");
    P(`Resultado: ${c.r.ok ? "CUMPLE" : "NO CUMPLE"}`, { bold: true, color: c.r.ok ? "2E7D4F" : "B23B2E" });
  }
  if (z) {
    Hd("6. Diseño de cimentación");
    Hd(`Zapata aislada Z-1 (${z.z.B} × ${z.z.L} × ${z.z.h} cm)`, 2);
    F(`q neta = q adm − γ·Df = ${z.qadm} − ${z.gam}×${z.Df} = ${n2(z.qadm - z.gam * z.Df)} t/m²; A req = ${n2(z.Ps / (z.qadm - z.gam * z.Df))} m²`);
    F(`qu = ${n2(z.z.qu)} t/m²; punzonamiento Vu = ${n2(z.z.Vp / 1000)} t ≤ φVc = ${n2(z.z.phVp / 1000)} t`, "ACI 22.6");
    F(`Cortante en una dirección Vu = ${n2(z.z.V1 / 1000)} t ≤ φVc = ${n2(z.z.phV1 / 1000)} t; Mu = ${n2(z.z.Mu / 1e5)} t·m`, "ACI 13.2, 22.5");
    F(`Acero: #${z.num} @ ${z.z.s} cm ambos sentidos (${z.z.n} vars, As = ${n2(z.z.As)} cm² por sentido)`, "ACI 8.6.1.1");
    P(`Resultado: ${z.z.ok ? "CUMPLE" : "NO CUMPLE"}`, { bold: true, color: z.z.ok ? "2E7D4F" : "B23B2E" });
  }
  if (window.VC_ARQ) { const ins = window.VC_ARQ.resumen(); if (ins) {
    Hd("7. Instalaciones");
    Hd("Instalación eléctrica — cuadro de cargas", 2); T(ins.cargas.enc, ins.cargas.filas); ins.cargas.notas.forEach(x => P(x));
    Hd("Instalación hidrosanitaria — unidades mueble y gasto", 2); T(ins.hidro.enc, ins.hidro.filas); ins.hidro.notas.forEach(x => P(x));
  } }
  Hd("8. Recomendaciones");
  ["Confirmar capacidad de carga con estudio de mecánica de suelos antes de construir.", "Usar el espectro de PRODISIS del predio para el diseño definitivo.", "Los elementos mecánicos deben provenir del análisis estructural completo del proyecto.", "Verificar en obra recubrimientos, traslapes y confinamiento conforme a planos E-01 y E-02."].forEach(r => kids.push(new Paragraph({ text: r, bullet: { level: 0 } })));
  Hd("9. Responsiva");
  P("El presente documento se elaboró con base en la información disponible y los supuestos señalados. Su validez queda sujeta a la revisión, aprobación y firma del Director Responsable de Obra y, en su caso, del Corresponsable en Seguridad Estructural, así como a la autorización de la autoridad municipal.");
  kids.push(new Paragraph({ text: "" })); kids.push(new Paragraph({ text: "" }));
  P("______________________________"); P(dp.elab || "Ing. Miguel Estrada"); P(dp.dro || "DRO / Perito en edificación");
  const doc = new Document({
    creator: dp.elab || "Vértice", title: `Memoria de cálculo — ${dp.proyecto}`,
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1247, right: 1247 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: `Vértice Ingeniería, Arquitectura y Proyectos · ${dp.proyecto}`, size: 16, color: "5B656E" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: LEY, size: 16, color: "B23B2E" })] })] }) },
      children: kids }]
  });
  return D.Packer.toBlob(doc);
}

/* ---------------- interfaz ---------------- */
function refrescar() { ["trabe", "columna", "zapata", "muros", "sismo", "programa"].forEach(p => { try { RUN[p](); } catch (e) { } }); try { RUN.presupuesto(true); } catch (e) { } }
function revisar() {
  const o = [], t = RES.trabe, c = RES.columna, z = RES.zapata;
  o.push(t ? `Trabe T-1: ${t.ok ? "cumple" : "NO cumple"}` : "Trabe: sin datos");
  o.push(c ? `Columna C-1: ${c.r.ok ? "cumple" : "NO cumple"} (D/C ${nf(c.r.DC)})` : "Columna: sin datos");
  o.push(z ? `Zapata Z-1: ${z.z.ok ? "cumple" : "NO cumple"} (${z.z.B}×${z.z.L}×${z.z.h})` : "Zapata: sin datos");
  if (RES.muros) o.push(`Muros: ${RES.muros.res.map(r => `${r.dir} ${r.ok ? "cumple" : "NO cumple"}`).join(", ")}`);
  if (RES.sismo) o.push(`Sismo: V base ${nf(RES.sismo.R.V)} t, espectro ${RES.sismo.orig}`);
  o.push(typeof LAST_PR !== "undefined" && LAST_PR ? `Presupuesto: $${nf(LAST_PR.sub, 0)} sin IVA` : "Presupuesto: cargando base de precios");
  o.push(typeof LAST_PG !== "undefined" && LAST_PG ? `Programa: ${nf(LAST_PG.fin, 1)} días hábiles` : "Programa: sin datos");
  $("#e-check").innerHTML = o.map(x => `<li>${esc(x)}</li>`).join("");
}
const supDef = "Elementos mecánicos de trabe y columna | Capturados a mano | Confirmar con el análisis del proyecto";
$("#e-sup").value = st.get("e_sup") ?? supDef;
$("#e-sup").addEventListener("input", e => st.set("e_sup", e.target.value));
document.querySelector('#tabs button[data-p="entregables"]').addEventListener("click", () => { refrescar(); revisar(); });
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-gen]"); if (!b) return;
  const tipo = b.dataset.gen, stEl = $("#e-status"); refrescar(); revisar();
  const nom = slug(DP().proyecto);
  try {
    b.disabled = true; stEl.textContent = "Generando…";
    const hacer = async t => {
      if (t === "docx") save(await memoria(), `Memoria_calculo_${nom}.docx`);
      if (t === "dxf") { const { h1, h2, extra } = planos(); save(zip([{ name: "E-01_cimentacion.dxf", data: h1.dxf() }, { name: "E-02_trabes_columnas.dxf", data: h2.dxf() }, ...extra.map(x => ({ name: `${x.clave}_${slug(x.nombre)}.dxf`, data: x.d.dxf() }))]), `Planos_DXF_${nom}.zip`); }
      if (t === "pdf") { const { h1, h2, extra } = planos(); save(pdf([h1, h2, ...extra.map(x => x.d)]), `Planos_${nom}.pdf`); }
      if (t === "xlsx") save(excel(), `Presupuesto_programa_${nom}.xlsx`);
    };
    if (tipo === "todo") { for (const t of ["docx", "dxf", "pdf", "xlsx"]) { await hacer(t); await new Promise(r => setTimeout(r, 700)); } }
    else await hacer(tipo);
    stEl.textContent = "Listo. Revisa tu carpeta de descargas. " + LEY + ".";
  } catch (err) { stEl.textContent = "No se pudo generar: " + err.message; console.error(err); }
  finally { b.disabled = false; }
});
window.VC_ENTREGABLES = { planos, excel, memoria, pdf, zip, xlsx };
window.VCD = { Dibujo, Vista, hoja, tabla, envolver, escala, NOTAS, pdf, zip, save, slug, DP, CAPAS, RGB, latin, planos };
})();
