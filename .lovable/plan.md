# Simplificar "Producción Total" en el Sheet de Historial

## Objetivo
Integrar la producción total como parte del Resumen Contable del cierre (Sheet "Ver Detalles"), sin encerrarla en una tarjeta aparte y sin texto explicativo extra.

## Cambios (solo `src/routes/_app.ajustes.historial.tsx`, Sheet de cierre cerrado)
Reemplazar el bloque destacado actual (contenedor `bg-primary/5`, los textos "Salida real de inventario...", "Venta Real en Efectivo/Bancos", "(+) Fiados entregados este día" y "(=) Producción Total (Inventario)") por dos filas simples dentro de la misma lista `divide-y` del Resumen Contable, justo debajo de "Venta Real del Día":

1. **Fiados entregados del Día** — valor en naranja (`text-orange-600 dark:text-orange-400`), usa `fiadosDiaQ.data ?? 0`.
2. **Producción Total** — `round2(ventaReal + fiadosDiaQ.data)`, en negrita y color primario (`large`, `font-bold text-primary`).

Queda el Resumen Contable así:
- Caja Inicial
- Egresos Totales
- Total Arqueo
- Venta Real del Día
- Fiados entregados del Día
- Producción Total

Eliminar el `Separator` y el contenedor que envolvía la producción. El acordeón "Ver lista de gastos del día" se mantiene debajo sin cambios.

## No se toca
- Consultas, fórmulas ni el Sheet retroactivo (no tiene este bloque).
- La tarjeta "Producción Total del Día" del Dashboard de Inicio (fuera de alcance).

## Verificación
Revisar el Sheet "Ver Detalles" de un cierre cerrado en /ajustes/historial: deben verse las dos filas nuevas integradas al Resumen Contable, sin la tarjeta extra ni el texto descriptivo.
