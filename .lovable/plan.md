## Plan: Arqueo / Cierre de Caja

No existe aún un componente de arqueo en el proyecto, así que se creará desde cero como una nueva ruta dentro de Ajustes (sólo admin), siguiendo el patrón existente.

### 1. Nueva ruta
- Crear `src/routes/_app.ajustes.arqueo.tsx` con `createFileRoute("/_app/ajustes/arqueo")`.
- Añadir tab **"Arqueo"** en `src/routes/_app.ajustes.tsx` (`{ to: "/ajustes/arqueo", label: "Arqueo" }`).

### 2. Estado (todos números, vacíos = 0)
Un único `useState` con objeto, o estados separados:
- `cajaInicial`
- `totalEgresos`
- `arqueoBancos` (con dos sub-inputs informativos: Guayaquil + Pichincha que suman a `arqueoBancos`)
- `arqueoBilletes`
- `valorMonedas1`, `valorMonedas50`, `valorMonedas25`, `valorMonedas10`, `valorMonedas5`

Helper `num(v)` que devuelve `Number(v) || 0` para manejar inputs vacíos.

### 3. Lógica matemática (exacta)
```ts
const totalMonedas    = v1 + v50 + v25 + v10 + v5;
const totalArqueoCaja = arqueoBancos + arqueoBilletes + totalMonedas;
const cajaMenosEgresos = cajaInicial - totalEgresos;
const ventaDelDia     = totalArqueoCaja - cajaMenosEgresos;
```
Calculados con `useMemo` en cada render.

### 4. UI (Tailwind + shadcn)
Layout en `max-w-3xl mx-auto`, dos `Card` principales:

**Card "Datos de caja"**
- Input `cajaInicial` — label: "Caja inicial ($)"
- Input `totalEgresos` — label: "Total egresos del día ($)"

**Card "Arqueo físico y digital"**
- Sub-sección Bancos: dos inputs (Banco Guayaquil, Banco Pichincha); `arqueoBancos = guayaquil + pichincha` mostrado como subtotal.
- Input `arqueoBilletes` — "Total ($) en billetes físicos"
- Sub-sección Monedas (5 inputs):
  - "Total ($) en monedas de $1"
  - "Total ($) en monedas de 50ctvs"
  - "Total ($) en monedas de 25ctvs"
  - "Total ($) en monedas de 10ctvs"
  - "Total ($) en monedas de 5ctvs"
- Subtotal en vivo: **"Total Arqueo Caja: $ {totalArqueoCaja.toFixed(2)}"**

**Card resultado (destacada)**
- Fondo `bg-primary/10`, borde `border-primary`, grande:
  - "Total Venta del Día: $ {ventaDelDia.toFixed(2)}"
- Mini-línea informativa: `Caja − Egresos = ${cajaMenosEgresos.toFixed(2)}`.

Inputs: `<Input type="number" inputMode="decimal" step="0.01" min="0">` con `<Label>`. Grid `grid-cols-2 md:grid-cols-3 gap-3` para denominaciones.

### Notas técnicas
- Sin cambios de backend/DB en este paso (solo cálculo en cliente, como pidió el usuario).
- Sólo edita: `_app.ajustes.tsx` (añadir tab) y crea `_app.ajustes.arqueo.tsx`.
- Usa tokens del design system (no colores literales).
