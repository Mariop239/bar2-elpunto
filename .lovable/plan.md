## Objetivo
Eliminar errores de centavos por punto flotante: ningún número escrito a la base de datos debe tener más de 2 decimales. Solo afecta lógica de cálculo/escritura; sin cambios visuales.

## 1. Helper compartido
En `src/lib/utils.ts` añadir:

```ts
export function round2(n: number | string | null | undefined): number {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  if (!Number.isFinite(v)) return 0;
  return Math.round((v as number) * 100) / 100;
}
```

Reutilizable en todo el frontend antes de cualquier `insert` / `update` / RPC.

## 2. Puntos de escritura a corregir

### `src/routes/_app.registro.tsx`
- `recalcHistorialCajas(deltaEgreso)`: redondear `nuevoEgresos` y `nuevaVentaReal` antes del `UPDATE` a `historial_cajas`.
- `addEgreso.mutationFn`: redondear `m` (monto del gasto) antes del `insert` en `transacciones` y antes de pasarlo a `recalcHistorialCajas`.
- Cierre de caja (`insert` en `historial_cajas` + `insert` en `transacciones` del arqueo): redondear `caja_inicial`, `total_egresos`, `bancos`, `billetes`, `total_arqueo`, `venta_real`, cada valor del objeto `monedas` (m100/m050/m025/m010/m005, banco_pichincha, banco_guayaquil) y el `monto` de la transacción de arqueo.

### `src/routes/_app.ajustes.historial.tsx`
- `guardarMut.mutationFn`: redondear `billetes`, `bancos`, `totalArqueo`, `ventaReal` y cada campo dentro de `monedasObj` antes del `update` a `historial_cajas`.

### `src/routes/_app.deudores.$clienteId.tsx`
- `editar.mutationFn`: redondear `monto = cantidad * precio_unitario` antes del `update` de `deudas` (multiplicación de decimales es la fuente clásica del bug de centavos).
- `abonar.mutationFn`: redondear `p_monto` antes del `rpc("aplicar_abono", ...)`.

### `src/routes/_app.ajustes.catalogo.tsx`
- Crear producto: redondear `precio` antes del `insert`.
- Editar producto: redondear `precioNum` antes del `update`.

## 3. Notas técnicas
- No se cambian valores de solo lectura ni el formato visual (`formatCurrency` ya formatea a 2 decimales).
- No se modifica el esquema de BD ni los triggers — el redondeo se aplica en el cliente justo antes del envío, que es lo solicitado.
- Las sumas intermedias en memoria pueden seguir como están; lo que importa es que el valor final persistido pase por `round2`.

## Archivos modificados
- `src/lib/utils.ts` (añade `round2`)
- `src/routes/_app.registro.tsx`
- `src/routes/_app.ajustes.historial.tsx`
- `src/routes/_app.deudores.$clienteId.tsx`
- `src/routes/_app.ajustes.catalogo.tsx`
