"""VERTICE-CALCULO — motor de cálculo de Vértice Ingeniería, Arquitectura y Proyectos (Tijuana, B.C.).

Módulos:
    materiales   Varillas, concreto y acero (tablas y propiedades)
    cargas       Cargas muertas y vivas, combinaciones NTC y ACI
    sismo        Espectro de diseño (puntos de PRODISIS o paramétrico CFE), método estático, distorsiones
    concreto     Diseño ACI 318-19 en kgf-cm: flexión, cortante, columnas P-M, losas, longitudes de desarrollo
    cimentacion  Zapatas aisladas y corridas
    mamposteria  Muros de mampostería confinada (NTC Mampostería), método simplificado
    costos       FSR 2026, precios unitarios, presupuesto y exportación a Excel (lee Precios de Obra MX)
    programa     Ruta crítica (CPM), Gantt, flujo de caja, curva S, VPN y TIR
    dibujo       Planos DXF (AutoCAD R12) y PDF con cuadro de referencia Vértice; detalles estructurales
    memoria      Memoria de cálculo y dictamen en Word (.docx)

Todo resultado es para revisión y firma del DRO / Corresponsable en Seguridad Estructural.
"""
__version__ = "0.1.0"
LEYENDA = "Para revisión y firma del DRO / Corresponsable en Seguridad Estructural"
