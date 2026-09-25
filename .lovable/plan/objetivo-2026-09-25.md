## Objetivo
Permitir que el admin corrija la **Caja Inicial** al editar un cierre ya guardado en Historial de Cajas, recalculando la Venta Real al instante.

## Cambios (solo `src/routes/_app.ajustes.historial.tsx`)
1. **Formulario de edición**: añadir campo "Caja Inicial" (mismo estilo de campo de dinero, acepta coma o punto) arriba de Billetes/Bancos/Monedas. Se precarga con el valor guardado al entrar en modo edición.
2. **Cálculo en vivo**: la vista previa usa la caja inicial editada:
   `Venta Real = Total Arqueo - (Caja Inicial - Total Egresos)`.
3. **Guardar**: el update a `historial_cajas` incluye `caja_inicial` (redondeado a 2 decimales) y `venta_real` recalculada con el nuevo valor.
4. Tras guardar se refrescan Historial, Inicio y Registro (tarjeta Caja Inicial / Venta Real) como ya ocurre, con el aviso de éxito.

## Notas
- El total de egresos no cambia; solo se recalcula la venta real.
- El "saldo para mañana" (Total Arqueo) no depende de la caja inicial, así que no se altera.
