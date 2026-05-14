### Arquitectura Multi-Empresa (Multi-Tenant)

Para separar los datos de diferentes negocios y permitir que cada cuenta de correo (ej. `bar2uleam@gmail.com`) tenga su propio entorno aislado (productos, empleados, clientes, deudas), implementaremos una arquitectura Multi-Tenant estándar.

#### 1. Cambios en la Base de Datos (Migraciones)
- **Nuevas tablas:**
  - `empresas`: Almacenará los negocios (`id`, `nombre`, `created_at`).
  - `perfiles`: Vinculará el usuario de Supabase Auth (`auth.uid()`) con su respectiva empresa (`id`, `empresa_id`, `rol`).
- **Actualización de tablas existentes:**
  - Se añadirá la columna `empresa_id` a todas las tablas operativas: `empleados`, `categorias`, `productos`, `clientes`, `deudas`, `abonos` y `transacciones`.
- **Migración de datos legacy:**
  - Crearemos una empresa por defecto (ej. "El Punto") y asignaremos todos los registros actuales y usuarios existentes a esta empresa para no romper la información que ya tienes.
- **Seguridad (RLS):**
  - Modificaremos **todas las políticas RLS**. En lugar de permitir el acceso a cualquier usuario autenticado, las políticas exigirán que el `empresa_id` del registro coincida con el `empresa_id` del usuario que inició sesión en el dispositivo.

#### 2. Lógica de Autenticación y Cuentas
- **Registro de Nuevos Negocios (`/registro`):**
  - Crearemos una nueva pantalla pública donde un usuario nuevo podrá crear su cuenta de Supabase Auth, registrar el nombre de su negocio y generar automáticamente su primer "Empleado Administrador" (para el PIN).
- **Inicio de Sesión (`/login`):**
  - Al iniciar sesión en el dispositivo con un correo, el sistema detectará a qué empresa pertenece y cargará **únicamente** los empleados (para el PIN) de esa empresa.

#### 3. Adaptación del Frontend
- **Aislamiento de Datos:**
  - Como el RLS se encargará de filtrar los datos en el backend, las consultas (`SELECT`) actuales seguirán funcionando, pero solo devolverán los datos del negocio activo.
- **Inserción de Datos:**
  - Se actualizará el estado global (ej. Zustand o un React Context) para mantener en memoria el `empresa_id` actual.
  - Se modificarán las mutaciones (`INSERT`) en toda la app (crear producto, registrar deuda, crear empleado, etc.) para incluir el `empresa_id` del negocio activo.
- **Funciones de la Base de Datos (`aplicar_abono`, `recalcular_saldo_cliente`):**
  - Se actualizarán para que respeten y propaguen el contexto del `empresa_id`.

---

**¿Estás de acuerdo con este enfoque?** Una vez lo apruebes, comenzaremos ejecutando la migración de la base de datos para estructurar todo de forma segura.