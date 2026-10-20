# Integración con las apps de Miguel en GitHub y con Claude

Cuenta: `ingmiguelestradaf-rgb`. **Regla:** antes de leer un repo por primera vez en una conversación, y antes de cualquier commit o push, pide autorización a Miguel en una sola pregunta (qué repo, qué vas a leer o escribir). Nunca hagas push sin un "sí" explícito para ese push.

## VERTICE-CALCULO (motor de cálculo del despacho)
Repo `ingmiguelestradaf-rgb/vertice-calculo` · app: https://ingmiguelestradaf-rgb.github.io/VERTICE-CALCULO/

| Necesidad del contratista | Módulo | Cómo alimenta los formatos |
|---|---|---|
| Presupuesto y APU para cotizar | `vertice/costos.py` → `BaseDatos`, `apu_desde_base`, `Presupuesto`, `Sobrecosto` | El costo directo por insumo va a la hoja «Análisis» de `Cotizacion.xlsx`; el factor de sobrecosto es la misma fórmula `(1+ind)(1+fin)(1+util)(1+cargos)` |
| FSR y salario real | `BaseDatos().fsr(sd)` (IMSS con CEAV 2026, INFONAVIT, ISN B.C. 4.25 %) | Celda FSR de `Control_de_Personal.xlsx` y salario del operador en el costo horario |
| Programa de obra y costo semanal | `vertice/programa.py` → `Programa.calcular()`, `costo_por_semana()` | Columna «Costo programado» de `Flujo_de_Caja.xlsx`; % programado de la curva S en `Control_de_Obra.xlsx` |
| Flujo de caja | `flujo_de_caja(programa, monto, costo, EsquemaPago, EsquemaEgresos)` | Misma lógica que el Excel; úsalo para validar. Diferencia: en el Excel "semanas que tarda el cliente en pagar" cuenta desde la semana de la estimación |
| Precios de materiales | `datos/precios.json` (de precios-obra-) con factor regional Tijuana 10 % | Precios de materiales en APU |

Ejemplo para llenar el flujo desde el programa:
```python
import sys; sys.path.insert(0, "vertice-calculo")
from vertice.programa import Programa
p = Programa("Local comercial"); p.agregar("A", "Preliminares", 3, costo=40000)  # ...
p.calcular(); semanas = p.costo_por_semana()   # → pegar en Flujo semanal!C8:C59
```

## ObraLab (herramientas de control de obra)
Repo `ingmiguelestradaf-rgb/obra-lab` · app: https://ingmiguelestradaf-rgb.github.io/OBRA-LAB/

- Calculadoras para medir cantidades de los generadores: concreto y ollas, peso de varilla, cuantificador de acero, block, tablaroca, plafón, pintura, repellos.
- **Valor ganado (SPI/CPI)** y **PPC semanal**: misma lógica que la hoja «Avance» de `Control_de_Obra.xlsx`.
- Formatos de campo: reporte diario, liberación de colado, recorrido de seguridad semanal y 18 checklists de calidad por etapa: complementan las hojas «Reporte diario» y «Liberaciones y pruebas».
- Para publicar un formato del skill en ObraLab: agregar una entrada `tipo: "formato"` en `data/herramientas.json` (campos `campos` e `items`) y su novedad en `data/actualizaciones.json`, siguiendo las reglas del README (nunca borrar, sólo mejorar). Pide autorización antes del push.

## precios-obra- (Precios de Obra MX)
Base de precios de materiales y mano de obra que lee VERTICE-CALCULO. Úsala para APU; para cotizaciones formales sustituye por cotizaciones reales (`db.cotizaciones[...]`).

## Claude
- Redacción de cláusulas especiales, revisión de contratos del cliente (ver `guia_contratos.md`) y lectura de planos/PDF para generar generadores.
- Búsqueda web para verificar tasas y reformas antes de entregar: IVA fronterizo (vence 31-dic-2026), salario mínimo y UMA de cada año, reforma de jornada laboral, prima de riesgo IMSS.
- Si una tarea necesita una app que no existe (por ejemplo, control de almacén o facturación), dilo y propón agregarla a ObraLab o a VERTICE-CALCULO.
