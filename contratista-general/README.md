
# Contratista general — contratos y formatos (Baja California)

Kit del contratista general de **Vértice Ingeniería, Arquitectura y Proyectos** (Tijuana). Todo sale con membrete Vértice, en español, conforme al Código Civil para el Estado de Baja California y la legislación federal laboral, fiscal y de seguridad social aplicable.

## Qué hay aquí

| Ruta | Contenido |
|---|---|
| `assets/contratos/` | 4 contratos .docx en blanco listos para imprimir y llenar a mano |
| `assets/formatos/` | 6 libros .xlsx con fórmulas vivas, en blanco con filas de ejemplo |
| `assets/datos/plantilla_vacia.json` | Datos de un proyecto en blanco (porcentajes usuales precargados) |
| `assets/datos/ejemplo_proyecto.json` | Ejemplo lleno (adecuación de local comercial) |
| `scripts/generar_contratos.js` | Genera contratos llenos desde un JSON (montos con letra, partes, anexos) |
| `scripts/clausulas.js` | Texto de todas las cláusulas: aquí se ajustan las variantes |
| `scripts/generar_formatos.py` | Genera los 6 libros de Excel con los datos del proyecto |
| `references/marco_legal_bc.md` | Artículos, tasas y obligaciones con fuente y fecha de verificación |
| `references/guia_contratos.md` | Qué contrato usar, datos a pedir, variantes, revisión de contratos del cliente |
| `references/integracion_repos.md` | Cómo usar VERTICE-CALCULO, ObraLab y precios-obra- con estos formatos |

Contratos: `precio_alzado`, `precios_unitarios`, `subcontrato`, `arrendamiento` (con o sin operador).
Formatos: `flujo` (Flujo_de_Caja), `estimaciones`, `obra` (Control_de_Obra), `personal` (Control_de_Personal), `maquinaria` (Control_de_Maquinaria), `cotizacion`.

## Flujo de trabajo

1. **Entiende qué se pide** y elige el documento con `references/guia_contratos.md`. Si Miguel sólo quiere "el formato" en blanco, entrega el archivo de `assets/` tal cual y termina.
2. **Junta los datos en una sola pregunta.** La lista mínima por contrato está en la guía. Lo que no se sepa se deja vacío: sale como línea para llenar a mano. No inventes RFC, REPSE, registros patronales, cuentas ni nombres.
3. **Autorización para repos.** Si conviene traer el presupuesto, programa, FSR o precios de VERTICE-CALCULO, o cantidades de ObraLab, pide autorización antes de leer el repo y antes de cualquier push (ver `references/integracion_repos.md`). Sin autorización, trabaja con lo que Miguel da.
4. **Verifica lo que cambia con el tiempo** antes de entregar, con búsqueda web si la fecha lo amerita: tasa de IVA fronteriza (el estímulo del 8 % vence el 31-dic-2026), salario mínimo y UMA del año, etapa de la reducción de jornada (46 h desde 2027). Si algo cambió, ajusta el JSON o `clausulas.js` y anótalo en `references/marco_legal_bc.md` con la fecha.
5. **Genera**:
   ```bash
   cp assets/datos/plantilla_vacia.json /tmp/proyecto.json   # llénalo con los datos
   node scripts/generar_contratos.js /tmp/proyecto.json salida/ precio_alzado     # uno o varios tipos
   python3 scripts/generar_formatos.py /tmp/proyecto.json salida/ estimaciones flujo
   python3 <skill xlsx>/scripts/recalc.py salida/Estimaciones.xlsx                # cada libro, obligatorio
   ```
   Necesita `docx` (npm) y `openpyxl`. Lee el skill **docx** o **xlsx** sólo si vas a editar un archivo existente del cliente.
6. **Revisa antes de entregar**:
   - Contratos: convierte a PDF y mira portada, una página intermedia y la de firmas; busca líneas en blanco que no deberían estar en blanco; confirma que el monto con letra corresponde.
   - Excel: `recalc.py` con `total_errors: 0` y revisa 2-3 resultados clave a mano (neto de la carátula, totales del flujo, PU de la cotización).
7. **Entrega** el archivo con una línea de contexto y la lista de lo que quedó por llenar. Recuerda en una sola línea que el contrato debe revisarlo un abogado antes de firmar; no lo repitas en cada mensaje.

## Reglas de contenido

- **Precio alzado** sólo con proyecto completo; cambios únicamente por orden de cambio escrita con precio (arts. 2499-2500 CCBC). Si el alcance es incierto, recomienda precios unitarios.
- **Pagar no es aceptar**: todos los contratos excluyen la presunción del art. 2504 y formalizan la recepción con acta.
- **Pena convencional** diaria con tope (10 % por omisión), nunca acumulada con daños y perjuicios (arts. 1727-1734 CCBC).
- **Subcontratos**: sólo obra especializada con REPSE vigente que ampare la actividad, número aproximado de trabajadores, entrega mensual de CFDI de nómina, IMSS, INFONAVIT, ISR e IVA, e informativas ICSOE y SISUB; sin documentos, se retiene el pago (arts. 13-15 LFT, 15-A LSS, 27-V LISR, 5-II LIVA); la especialidad no debe ser parte de la actividad preponderante de Vértice. El formato de personal marca a quién retenerle.
- **Licencia, DRO y corresponsables** son del propietario salvo pacto (Reglamento de Edificaciones de Tijuana, art. 15); la bitácora la lleva la obra (art. 17).
- **IVA** a la tasa vigente en cada CFDI; los montos del contrato siempre van sin IVA más el impuesto.
- Si Miguel trae el contrato del cliente, no generes uno nuevo: revísalo con la lista de la guía y entrega observaciones con redacción alternativa.

## Cómo adaptar

- **Cláusula nueva o variante** (sin fianzas, pago por hitos distintos, garantía extendida): edita `scripts/clausulas.js`; cada contrato es una lista de `{t: título, p: [párrafos], items: [incisos]}` y la numeración PRIMERA… se pone sola.
- **Datos de Vértice** (titular, RFC, REPSE, registro patronal, CLABE): llénalos una vez en `empresa` de `plantilla_vacia.json` cuando Miguel los dé, y regenera `assets/`.
- **Formatos**: cada libro es una función en `generar_formatos.py`. Celdas amarillas con texto azul = captura; texto negro = fórmula. Mantén esa convención y vuelve a correr `recalc.py`.
- Si una tarea pide una herramienta que no existe en estos formatos ni en los repos (almacén, facturación, compras), dilo y propón dónde agregarla.
