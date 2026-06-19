# Arquitectura CSS de FitoScents

Este documento explica la organización del CSS dentro del proyecto tras la refactorización para eliminar estilos en línea y mejorar la mantenibilidad.

## 📁 Estructura de Archivos

Todos los estilos se encuentran dentro del directorio `/assets/css/`.

- **`variables.css`**: Contiene TODAS las variables CSS (`:root`). Define los colores del tema (modo oscuro por defecto), tipografías, bordes, sombras, etc.
- **`global.css`**: Define el diseño maestro ("App Shell"), incluyendo el Layout base, el Sidebar de navegación, la Topbar, tipografías globales y resets.
- **`[modulo].css`**: Archivos específicos para cada vista o componente de la aplicación. Ejemplos: `dashboard.css`, `ventas.css`, `novedades.css`, etc.

## 🚀 Reglas y Buenas Prácticas

1. **NO USAR `<style>` EN LÍNEA**: Ningún archivo HTML debe contener etiquetas `<style>`. Todo el CSS debe residir en su archivo correspondiente dentro de `assets/css/`.
2. **Usar Variables Globales**: Si necesitas el color de acento dorado, usa `var(--accent)` o `var(--gold)`. No "hardcodees" los valores hex/rgb en los módulos, a menos que sean opacidades muy específicas (ej: `rgba(201,168,76,.15)`).
3. **Modularidad**: Cada página (ej. `novedades.html`) carga un mínimo de estilos:
   ```html
   <link rel="stylesheet" href="../assets/css/variables.css">
   <link rel="stylesheet" href="../assets/css/global.css">
   <link rel="stylesheet" href="../assets/css/novedades.css">
   ```
4. **Utilidades en Global**: Si encuentras un estilo que se repite en más de dos archivos (ej: los botones `.btn-primary`, contenedores genéricos, insignias globales), muévelo a `global.css`.

## 📌 Guía de Componentes y Dónde Encontrarlos

- **Sidebar y Topbar**: En `global.css` (clases `.sidebar`, `.sidebar-nav`, `.topbar`).
- **Modales (Base)**: En `global.css` (`.modal-backdrop`, `.modal-box`).
- **Acordeones y Tablas**: Los estilos base están en `global.css`, pero las implementaciones específicas (ej: Modal de Registro de Día) están en `ventas.css`.
- **Insignias (Badges)**: 
  - `encargos.css`: `.estado-badge` (pendientes, buscando, conseguido).
  - `perfumes-completos.css`: `.concentracion-badge`, `.stock-badge`.
- **Selector/Buscador de Perfumes**: Está centralizado en `ventas.css` (`.perf-dropdown`, `.perf-option`).

## 🛠 Mantenimiento

Para agregar una nueva pantalla:
1. Crea tu archivo HTML en `/admin/`.
2. Crea el archivo CSS correspondiente en `/assets/css/`.
3. Vincula `variables.css`, `global.css` y el nuevo CSS.
4. Reutiliza las clases globales siempre que sea posible.
