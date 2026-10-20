# Guía para elegir, llenar y revisar contratos

## Qué contrato usar

| Situación | Contrato | Rol de Vértice |
|---|---|---|
| El cliente quiere un precio cerrado y el proyecto está completo (planos, especificaciones, acabados definidos) | `precio_alzado` | EL CONTRATISTA |
| El proyecto puede cambiar, hay volúmenes inciertos (excavación, demoliciones, adecuaciones) o el cliente pide pagar lo ejecutado | `precios_unitarios` | EL CONTRATISTA |
| Vértice contrata a un especialista (eléctrico, HVAC, impermeabilización, tablaroca, aluminio) | `subcontrato` | EL CONTRATISTA (el especialista es EL SUBCONTRATISTA) |
| Vértice renta retro, compactador, andamio, bomba, grúa | `arrendamiento` | EL ARRENDATARIO |

Regla práctica: si no puedes cuantificar el 90 % de la obra con los planos, no cotices a precio alzado. El art. 2499 del CCBC te impide cobrar aumentos de materiales o jornales.

## Datos mínimos antes de generar (se piden en una sola pregunta)

**Todos:** nombre o razón social de la contraparte, persona física o moral, representante y poder (si es moral), RFC, domicilio, correo, nombre y ubicación de la obra, monto sin IVA, fecha de inicio y plazo.

**Precio alzado / precios unitarios:** anticipo %, fondo de garantía %, periodo de estimación, días de revisión y de pago, fianzas (sí/no y %), meses de vicios ocultos, pena diaria y tope, licencia (si ya existe), supervisor del cliente, descripción del alcance (sale del presupuesto o de la cotización).

**Subcontrato:** especialidad, número aproximado de trabajadores (obligatorio por art. 13 LFT), REPSE y registro patronal del subcontratista, contrato principal del que deriva, días de pago tras cobro y plazo máximo.

**Arrendamiento:** equipos con marca, modelo, serie, horómetro, tarifa, unidad y mínimo; con o sin operador; quién pone el combustible; flete; depósito; plazo.

Los datos de Vértice (titular, RFC, REPSE, registro patronal, CLABE) se llenan una sola vez en la sección `empresa` del JSON. Si faltan, el documento sale con líneas para llenar a mano: avisa cuáles quedaron en blanco.

## Variantes que se ajustan editando `scripts/clausulas.js`

- **Sin anticipo:** pon `anticipo_pct: 0` (el subcontrato omite el párrafo; en obra, la cláusula de ANTICIPO queda en 0 % — si se quiere quitar, elimina la cláusula del arreglo).
- **Sin fianzas** (obras chicas, clientes particulares): `fianza_anticipo: false` y explica que el fondo de garantía sustituye la de vicios; para quitar la de cumplimiento edita la cláusula GARANTÍAS.
- **Cliente persona física que contrata su casa:** precio alzado o unitarios funcionan igual; revisa que el cliente entienda que la licencia y el DRO son suyos salvo que Vértice los incluya (entonces muévelos al Anexo B y a "Incluye" de la cotización).
- **Vértice como DRO de la misma obra:** no lo metas en el contrato de obra; haz un contrato de prestación de servicios profesionales aparte (arts. 2479-2488 CCBC).

## Revisión de un contrato que trae el cliente (Vértice como contratista)

Cuando Miguel comparta el contrato del cliente, revisa contra esta lista y entrega observaciones con la redacción alternativa:

1. **Pena sin tope** o tope mayor al 10 %: proponer tope (art. 1730 CCBC limita a la obligación principal, pero un 10 % es lo usual).
2. **Pena y daños y perjuicios a la vez:** el art. 1727 los excluye si se pactó pena; pedir que se respete.
3. **"El pago no implica aceptación" sin plazo de recepción:** exigir plazo de recepción y recepción tácita.
4. **Pago sin plazo** o "pagaremos cuando el cliente final nos pague" sin plazo máximo.
5. **Sin intereses moratorios** ni derecho a suspender por falta de pago.
6. **Retención de garantía sin fecha de devolución** o mayor al 10 %.
7. **Precio alzado con proyecto incompleto:** pedir que lo no definido sea a precios unitarios o con orden de cambio.
8. **Ajuste de costos prohibido** en obras largas a precios unitarios.
9. **Licencias, DRO, acometidas y derechos a cargo del contratista** sin que estén en el precio.
10. **Responsabilidad ilimitada por vicios** o garantía mayor a la usual (12 meses obra general; las de fabricante aparte).
11. **Jurisdicción fuera de Tijuana** o arbitraje costoso para el monto.
12. **Cesión de derechos de cobro prohibida** (impide factoraje).

## Revisión antes de firmar (siempre)

- Que los anexos existan y estén firmados: un contrato de obra sin planos ni presupuesto choca con el art. 2491.
- Que la cotización aceptada y el contrato digan lo mismo en anticipo, pago, plazo, inclusiones y exclusiones.
- Que el CFDI se emita a nombre de quien firma y con el RFC del contrato.
- Para subcontratos: constancia REPSE vigente que ampare la especialidad, opinión 32-D positiva, alta en SIROC antes de entrar a obra, y que la especialidad no forme parte de la actividad preponderante de Vértice registrada ante el SAT (art. 13 LFT): si Vértice tiene registrada "construcción de inmuebles" como actividad, subcontrata sólo especialidades distintas (instalaciones, HVAC, impermeabilización, cancelería) y documenta por qué son especializadas.
- Firmar por duplicado con dos testigos y rubricar todas las hojas.
