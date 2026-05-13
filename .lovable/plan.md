### Cambios propuestos para el Panel de Categorías

1. **Nueva Pestaña en Ajustes**
   - Agregaremos una nueva pestaña llamada "Categorías" en el módulo de Ajustes, junto a Catálogo, Empleados e Historial.

2. **Gestión de Categorías (`/ajustes/categorias`)**
   - **Crear Categorías:** Un pequeño formulario donde podrás escribir el nombre de la nueva categoría y elegir su color.
   - **Editar Categorías:** Una lista con todas las categorías existentes. Podrás editar directamente el nombre escribiendo sobre él y cambiar el color con un menú desplegable.
   - **Eliminar Categorías:** Botón para borrar categorías. (Nota: Si una categoría tiene productos asignados, el sistema no te dejará borrarla por seguridad; primero tendrás que cambiar esos productos a otra categoría).

3. **Expansión de Colores**
   - Agregaremos más opciones de colores sutiles para los botones del POS. 
   - Colores disponibles: Gris (Slate), Azul, Naranja, Verde, Rojo, Amarillo, Morado y Rosa.
   - Actualizaremos los botones de la pantalla de Registro para que reconozcan estos nuevos colores de forma automática.

### Detalles técnicos:
- Se creará la nueva ruta `src/routes/_app.ajustes.categorias.tsx`.
- Se actualizará el menú de navegación de ajustes (`src/routes/_app.ajustes.tsx`).
- Se expandirá el mapeo de colores (`bgMap`) en `src/routes/_app.registro.tsx` para soportar las nuevas opciones elegibles desde el panel.