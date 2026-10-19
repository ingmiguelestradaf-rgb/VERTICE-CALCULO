/* Vértice Cálculo — varios proyectos en el mismo equipo, con exportar/importar archivo .json */
"use strict";
(function () {
  const LS = (() => { try { const k = "__t"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();
  const get = (k, d) => { try { const v = LS && LS.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => { try { LS && LS.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const datos = () => { const o = {}; if (!LS) return o; for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (/^vc_(f_|t_|s_pts|e_sup)/.test(k)) o[k] = LS.getItem(k); } return o; };
  const limpiar = () => { if (!LS) return; Object.keys(datos()).forEach(k => LS.removeItem(k)); };
  const cargar = d => { limpiar(); if (LS) Object.entries(d || {}).forEach(([k, v]) => LS.setItem(k, v)); };
  let lista = get("vc_proyectos", {}), actual = get("vc_actual", null);
  if (!actual || !lista[actual]) { actual = actual || "Casa habitación 2 niveles (ejemplo)"; lista[actual] = lista[actual] || { datos: datos(), fecha: Date.now() }; put("vc_proyectos", lista); put("vc_actual", actual); }
  const guardar = () => { lista[actual] = { datos: datos(), fecha: Date.now() }; put("vc_proyectos", lista); };
  let tmr = null; const auto = () => { clearTimeout(tmr); tmr = setTimeout(guardar, 400); };
  ["input", "change", "click"].forEach(ev => document.addEventListener(ev, auto, true));

  const bar = document.createElement("div");
  bar.className = "projbar";
  bar.innerHTML = `<label for="pj-sel">Proyecto</label><select id="pj-sel"></select>
    <button class="pbtn" id="pj-new" type="button">Nuevo</button><span id="pj-newbox" hidden><input id="pj-name" placeholder="Nombre del proyecto"><button class="pbtn" id="pj-ok" type="button">Crear</button><button class="pbtn" id="pj-cancel" type="button">Cancelar</button></span>
    <button class="pbtn" id="pj-dup" type="button">Duplicar</button><button class="pbtn" id="pj-exp" type="button">Exportar</button><label class="pbtn" for="pj-imp">Importar</label><input id="pj-imp" type="file" accept=".json,application/json" hidden><button class="pbtn" id="pj-del" type="button">Borrar</button>`;
  const css = document.createElement("style");
  css.textContent = `.projbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;padding-bottom:4px}
  .projbar select,.projbar input{font:13px var(--f-body);padding:4px 6px;border-radius:4px;border:1px solid #5b656e;background:#252b30;color:#eef0f1;max-width:260px}
  .pbtn{font:600 12px var(--f-body);padding:4px 9px;border-radius:4px;border:1px solid #5b656e;background:transparent;color:#eef0f1;cursor:pointer}
  .pbtn:hover{border-color:#e2a300}`;
  document.head.appendChild(css);
  document.querySelector(".band .wrap").insertBefore(bar, document.getElementById("tabs"));
  const $ = s => document.querySelector(s);
  const pinta = () => { $("#pj-sel").innerHTML = Object.keys(lista).sort((a, b) => a.localeCompare(b, "es")).map(n => `<option ${n === actual ? "selected" : ""}>${n.replace(/</g, "&lt;")}</option>`).join(""); };
  pinta();
  const ir = n => { guardar(); actual = n; put("vc_actual", n); cargar(lista[n].datos); location.reload(); };
  const unico = n => { let x = n.trim() || "Proyecto", i = 2; while (lista[x]) x = `${n.trim()} (${i++})`; return x; };
  $("#pj-sel").onchange = e => ir(e.target.value);
  $("#pj-new").onclick = () => { $("#pj-newbox").hidden = false; $("#pj-name").focus(); };
  $("#pj-cancel").onclick = () => { $("#pj-newbox").hidden = true; };
  $("#pj-ok").onclick = () => {
    const n = unico($("#pj-name").value || "Proyecto nuevo"); guardar();
    lista[n] = { datos: { vc_f_entregables: JSON.stringify({ proy: n }), vc_f_presupuesto: JSON.stringify({ proy: n }) }, fecha: Date.now() }; put("vc_proyectos", lista); ir(n);
  };
  $("#pj-name").addEventListener("keydown", e => { if (e.key === "Enter") $("#pj-ok").click(); });
  $("#pj-dup").onclick = () => { guardar(); const n = unico(actual + " copia"); lista[n] = { datos: datos(), fecha: Date.now() }; put("vc_proyectos", lista); ir(n); };
  $("#pj-exp").onclick = () => {
    guardar(); const blob = new Blob([JSON.stringify({ tipo: "vertice-calculo-proyecto", version: 1, nombre: actual, fecha: new Date().toISOString(), datos: lista[actual].datos }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = actual.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_") + ".vertice.json"; document.body.appendChild(a); a.click(); a.remove();
  };
  $("#pj-imp").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (j.tipo !== "vertice-calculo-proyecto" || !j.datos) throw 0; guardar(); const n = unico(j.nombre || f.name); lista[n] = { datos: j.datos, fecha: Date.now() }; put("vc_proyectos", lista); ir(n); }
    catch (err) { alertaBar("Ese archivo no es un proyecto de Vértice Cálculo."); }
    e.target.value = "";
  };
  let borrar = false;
  $("#pj-del").onclick = () => {
    if (Object.keys(lista).length < 2) { alertaBar("Es el único proyecto; crea otro antes de borrarlo."); return; }
    if (!borrar) { borrar = true; $("#pj-del").textContent = "Toca otra vez para borrar"; setTimeout(() => { borrar = false; $("#pj-del").textContent = "Borrar"; }, 3000); return; }
    delete lista[actual]; put("vc_proyectos", lista); const n = Object.keys(lista)[0]; actual = n; put("vc_actual", n); cargar(lista[n].datos); location.reload();
  };
  function alertaBar(t) { let s = $("#pj-msg"); if (!s) { s = document.createElement("span"); s.id = "pj-msg"; s.style.color = "#e2a300"; bar.appendChild(s); } s.textContent = t; setTimeout(() => s.textContent = "", 4000); }
})();
