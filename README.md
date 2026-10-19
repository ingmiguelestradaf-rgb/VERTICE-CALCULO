# VERTICE-CALCULO

Motor de cálculo de **Vértice Ingeniería, Arquitectura y Proyectos** (Tijuana, B.C.). Hace en Python lo que pide el skill *despacho-ingenieria-arquitectura*: análisis y diseño estructural, memoria de cálculo, planos DXF/PDF, presupuesto con precios unitarios, programa de obra y flujo de caja.

**Úsalo en el navegador:** https://ingmiguelestradaf-rgb.github.io/VERTICE-CALCULO/

- **Proyectos:** barra superior para crear, cambiar, duplicar, exportar e importar proyectos (archivo `.vertice.json`). Cada proyecto guarda todas sus pestañas en tu equipo.
- **Cálculo:** trabe, columna (diagrama P-M), zapata, muros de mampostería, sismo estático, presupuesto con precios unitarios y programa con ruta crítica y flujo de caja.
- **Arquitectura e instalaciones:** capturas los espacios de cada nivel y se dibujan plantas arquitectónicas (A-01), fachada y corte (A-02), instalación eléctrica con cuadro de cargas (IE-01) e hidrosanitaria con unidades mueble (IH-01), con vista previa en pantalla.
- **Entregables:** descarga memoria de cálculo (.docx), planos E-01, E-02, A-01, A-02, IE-01 e IH-01 (.dxf para AutoCAD y .pdf) y presupuesto, APU y programa (.xlsx con fórmulas). Todo se genera en el navegador; nada se sube a un servidor.

Los cálculos estructurales son los mismos que los del motor en Python.

Autor: Ing. Miguel Estrada · Todo resultado es **para revisión y firma del DRO / Corresponsable en Seguridad Estructural**.

## Instalación

Requiere Python 3.10+ con `numpy`, `matplotlib`, `openpyxl` y `python-docx`:

```
pip install numpy matplotlib openpyxl python-docx
```

No necesita AutoCAD ni librerías de DXF: los planos se escriben en DXF R12, que abre cualquier versión de AutoCAD, BricsCAD o DraftSight.

## Prueba rápida

```
python ejemplos/casa_dos_niveles.py      # genera ejemplos/salida/
python -m unittest discover tests        # 13 pruebas con cálculos verificados a mano
```

El ejemplo resuelve una casa de 2 niveles (8 × 10 m) y entrega memoria `.docx`, planos E-01 y E-02 en DXF y PDF, presupuesto `.xlsx` con fórmulas vivas, programa con ruta crítica, Gantt, flujo de caja y curva S.

## Módulos (`vertice/`)

| Módulo | Qué hace | Referencia |
|---|---|---|
| `materiales` | Varillas #2.5–#12 (área, peso), concreto (Ec, β1), acero | NMX-B-506 / ASTM A615, ACI 318-19 |
| `cargas` | Sistemas de piso con desglose, cargas vivas por destino, combinaciones NTC y ACI | NTC Criterios y Acciones, ASCE 7 |
| `sismo` | Espectro desde PRODISIS (puntos o CSV) o paramétrico CFE-2015, Q', R, método estático, periodo de Rayleigh, distorsiones | MDOC-CFE Sismo 2015 |
| `concreto` | Flexión, cortante, diagrama de interacción P-M, espesores de losa, acero de temperatura, ld, traslapes y ganchos, en kgf-cm | ACI 318-19 |
| `cimentacion` | Zapata aislada (punzonamiento, cortante, flexión) y corrida | ACI 318-19 cap. 13 |
| `mamposteria` | Muros confinados: VmR, FAE, método simplificado, confinamiento | NTC Mampostería |
| `costos` | FSR 2026 (IMSS con CEAV, Infonavit, ISN B.C.), APU, presupuesto, explosión de insumos, sensibilidad, Excel | Lee `precios.json` y `mano-obra.json` de [precios-obra-](https://github.com/ingmiguelestradaf-rgb/precios-obra-) |
| `programa` | CPM con holguras, Gantt, costo semanal, flujo de caja con anticipo/estimaciones/retención, curva S, VPN, TIR | |
| `dibujo` | Hoja con cuadro de referencia Vértice, ejes, secciones, elevación de trabe, zapatas, tablas; DXF + PDF | |
| `memoria` | Memoria de cálculo y dictamen en Word con portada, tablas de supuestos y responsiva | |

### Convención de planos

El DXF está en **milímetros de papel** sobre una hoja de 900 × 600 mm: se imprime 1:1 y cada detalle lleva rotulada su escala (`Vista(dib, x0, y0, esc)` convierte cm reales a mm de papel). Capas: MARCO, CUADRO, TEXTO, COTAS, EJES, CONCRETO, ACERO, ESTRIBOS, MUROS, OCULTO, NOTAS, SUELO, INSTALACION.

### Precios

`costos.BaseDatos()` busca primero una copia local de `precios-obra-` en la carpeta hermana, luego la copia en `datos/` y si no hay, descarga de GitHub. Las cotizaciones reales sustituyen a la base con `db.cotizaciones["varilla-3-8"] = 25100`. Los precios nacionales se ajustan a Tijuana con `factor_regional` (10 % por omisión).

## Límites y cuidados

- El espectro paramétrico es para estudios previos; para diseño usa el espectro de PRODISIS del sitio.
- Sin estudio de mecánica de suelos la capacidad de carga es un **supuesto a validar**.
- `v*m` de mampostería, distorsiones límite y salarios de mercado son valores de referencia: verifícalos contra la norma adoptada por el municipio, pruebas de laboratorio y tus listas de raya.
- El método estático requiere estructura regular y altura moderada; edificios mayores necesitan análisis dinámico modal (pendiente en la hoja de ruta).

## Hoja de ruta

1. Análisis dinámico modal y marcos 2D por rigideces.
2. Losas en dos direcciones por coeficientes (NTC) y losas aligeradas / vigueta y bovedilla.
3. Diseño de acero estructural (AISC 360) y conexiones básicas.
4. Planos arquitectónicos y de instalaciones a partir de un modelo de ejes y muros.
5. Cuadros de cargas eléctricas (NOM-001-SEDE) y cálculo hidráulico por unidades mueble.
