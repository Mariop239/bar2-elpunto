Voy a implementar estas mejoras creando exportaciones limpias en formato nativo de Excel (`.xlsx`), lo que soluciona todos los problemas de separadores, formato de moneda y visualización que suelen ocurrir con los CSV.

Aquí está el plan de implementación:

1. **Agregar librería Excel:**
   - Instalaré la librería `xlsx` para generar archivos `.xlsx` reales que abran perfectamente en Excel sin necesidad de configurar separadores ni codificación.

2. **Nuevo Reporte de Transacciones ("Reporte Diario / Rango"):**
   - Extraerá las transacciones del rango de fechas seleccionado (Ingresos, Costos, Gastos).
   - Incluirá el nombre del empleado que realizó la transacción consultando la base de datos.
   - Usará los encabezados exactos que pediste: `FECHA`, `CATEGORÍA`, `MÉTODO PAGO`, `PRODUCTO/CONCEPTO`, `MONTO $`, `EMPLEADO`.
   - Formateará la fecha como `DD/MM/YYYY HH:mm` y dejará el monto como un número decimal limpio para que Excel permita sumarlo y filtrarlo nativamente.

3. **Nuevo Reporte de Deudores ("Lista de Deudores"):**
   - Extraerá todos los clientes y calculará su saldo total.
   - Revisará las deudas pendientes de cada cliente para encontrar la fecha de la deuda más antigua.
   - Usará los encabezados: `NOMBRE DEL CLIENTE`, `SALDO TOTAL $`, `FECHA DEUDA MÁS ANTIGUA`.
   - Solo incluirá a los clientes que tengan un saldo total mayor a cero.

4. **Actualización de la Interfaz:**
   - Reemplazaré los 3 botones pequeños de exportación en la vista "Historial" por dos botones más claros y grandes: **"Exportar Transacciones"** y **"Exportar Deudores"**.

Todo mantendrá la estética actual y la misma selección de fechas "Desde" y "Hasta" funcionará para las transacciones.