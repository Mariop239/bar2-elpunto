# Plan: Métrica "Fiado Hoy" y "Producción Total" en el Dashboard

## Objetivo
Añadir al Dashboard principal (`src/routes/_app.inicio.tsx`) dos nuevos indicadores sin alterar la fórmula existente de Arqueo de Caja ni la Venta Real del Día.

Decisiones confirmadas con el usuario:
- **Fiado Hoy** = suma de `deudas` creadas hoy con `estado = 'pendiente'` (solo pendientes).
- **Layout** = misma fila que las tarjetas actuales, 4 columnas en desktop / 2 en móvil; "Producción Total" como tarjeta destacada aparte.

## Datos
Tabla `deudas` (pública, con RLS ya concedida a `authenticated`):
- `monto numeric`, `created_at timestamptz`, `estado estado_deuda` (`pendiente` | `pagado`).

## Cambios en `src/routes/_app.inicio.tsx`

### 1. Nueva query `fiado-hoy`
- `queryKey: ["fiado-hoy", todayDate()]`.
- `queryFn`: usar `localDayRange()` (rango local de Ecuador ya existente) y consultar
  `supabase.from("deudas").select("monto").eq("estado","pendiente").gte("created_at", ini).lte("created_at", fin)`.
- Sumar `monto` con `round2` (ya importado desde `@/lib/utils`) y devolver el total numérico.
- `refetchOnWindowFocus: true`.

### 2. Realtime
- En la suscripción `dashboard-sync` existente para la tabla `deudas`, añadir
  `qc.invalidateQueries({ queryKey: ["fiado-hoy"] })` junto a `["fiados-recientes"]`.
  Así el valor se actualiza solo al registrar/cobrar/eliminar fiados, sin recargar.

### 3. UI — fila de tarjetas a 4 columnas
- Cambiar el grid superior de `grid-cols-1 md:grid-cols-3` a `grid-cols-2 md:grid-cols-4`.
- Mantener las tres tarjetas actuales (Caja Inicial, Gastos/Egresos, Venta Real).
- Añadir cuarta tarjeta **"Fiado Hoy"**:
  - Icono `CreditCard` (o `Wallet`) de `lucide-react`.
  - Color naranja/ámbar sutil para indicar dinero pendiente de cobro:
    `bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50`,
    texto `text-orange-700 dark:text-orange-300`.
  - Valor: `formatCurrency(fiadoHoy)` (o "—" mientras carga).
  - Subtexto pequeño: "Pendiente de cobro".

### 4. UI — tarjeta destacada "Producción Total"
- Nueva `Card` debajo de la fila de 4 (fuera del grid).
- Fórmula: `produccionTotal = (ventaReal ?? 0) + fiadoHoy`.
  - Si `ventaReal` existe (arqueo del día): mostrar `formatCurrency(produccionTotal)`.
  - Si **no** hay arqueo: mostrar el `fiadoHoy` con una nota discreta "Pendiente de arqueo para total completo" (para no mezclar efectivo no confirmado).
- Estilo neutro/primario (p.ej. `bg-primary/5 border-primary/20`) y texto grande, sin sobresaltar más que la Venta Real.

## Invariantes que NO cambian
- No se toca `recalcHistorialCajas`, ni los campos de `historial_cajas`, ni la fórmula
  `venta_real = total_arqueo - (caja_inicial - egresos)`.
- `Fiado Hoy` es solo lectura/suma; no inserta ni actualiza registros.
- Se conservan `round2` para persistencia/suma y el rango local de Ecuador (`localDayRange`).

## Verificación
- `rg` para confirmar que no quedan referencias rotas a íconos nuevos.
- Revisar `/tmp/observability/build-errors.log` tras editar (compilación OK).
- En el preview: registrar un fiado nuevo hoy y confirmar que "Fiado Hoy" sube; cobrarlo y
  verificar que baja (pasa a `pagado` y deja de sumar) sin que cambie la Venta Real.
