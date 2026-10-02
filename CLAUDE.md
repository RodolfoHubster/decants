# FitoScents — Sistema de Decants

Tienda + panel admin de decants de perfume (Tijuana). **Vanilla JS con ES modules + Firebase
(Firestore/Auth). No hay backend ni build step**: los `.html` cargan los `.js` directo.

## Comandos

```bash
npm test          # Jest — 238 tests, con coverage
npm run lint      # ESLint sobre assets/js, admin, tests
node --check assets/js/ARCHIVO.js   # sintaxis rápida sin correr nada
```

Se prueba en **Live Server en :5501** (`.vscode/settings.json`), no en XAMPP. Live Server sirve el
**checkout principal** (`main`): lo editado en un worktree no se ve hasta hacer `git merge --ff-only` ahí. Los `.php` de `admin/`
(`get_git.php`, `proxy_upc.php`) sí requieren XAMPP, pero casi nunca se tocan.

## Mapa del código

```
index.html, perfumes-completos.html, faq.html   ← tienda pública
admin/*.html (18 páginas)                       ← una página por sección,
                                                  cada una importa admin/sidebar.js
assets/js/*.js                                  ← un módulo por página + módulos puros
assets/css/*.css                                ← variables.css + global.css + uno por página
firestore.rules                                 ← reglas de seguridad
tests/*.test.js                                 ← Jest, importan los módulos puros
```

### Módulos puros (sin DOM, los que cubren los tests)

`lotes.js` · `clientes-util.js` · `stock.js` · `precios.js` · `catalogo-cache.js` ·
`imagenes.js` · `hero.js` · `cart.js` · `slug.js` · `search-engine.js` ·
`alertas.js` (dashboard: resumen y recordatorios) · `pos-cliente.js` (atribución en la canasta)

**Patrón del proyecto: la lógica testeable se extrae a un módulo puro que el test
importa de verdad.** Nunca copies la lógica dentro del spec — si necesitas probar algo
que vive dentro de un archivo de página, primero extráelo.

### Archivos grandes — no los leas completos

`ventas.js` (2400 líneas) · `perfumes.js` (1775) · `catalog.js` (1447) · `estadisticas.js` (1060)

Búscalos con `grep -n 'nombreDeFuncion' archivo` y lee solo el rango con
`sed -n '400,480p'`. Leer uno completo se come decenas de miles de tokens.

### Colecciones de Firestore

`perfumes` · `ventas` · `paquetes` · `categorias` · `accesorios` · `marcas` · `novedades` ·
`pedidos` · `consignaciones` · `insumos` · `config` · `perfumes_completos` · `ordenes_completos`

`perfumes`, `marcas`, `categorias`, `paquetes`, `accesorios`, `novedades` y `config` son de
**lectura pública** — se pueden consultar sin auth para verificar datos reales.

## Convenciones que rompen cosas si se olvidan

- **Cache-busting**: al editar un `.js` hay que subir el `?v=` en el/los HTML que lo cargan,
  o el navegador sirve el viejo. Verifica qué versión se está cargando de verdad antes de
  concluir que un cambio "no funcionó".
  ```bash
  grep -rn 'perfumes\.js?v=' admin/*.html   # ver dónde está
  ```
- **Escrituras a Firestore por campo**: usar dot-notation (`{'precios.5': 90}`), no
  sobreescribir el objeto completo.
- **Nunca mostrar precio por mililitro** al cliente. Para empujar la talla grande se usa
  el **ahorro absoluto** (`precios.js → ahorroPorTalla`).
- **Clientes temporales**: los `Cliente 12` de Sobre Ruedas son gente de paso. Nunca
  agruparlos por nombre ni contarlos como recurrentes (`clientes-util.js`).
- **Un campo de precio vacío significa "esa talla no se vende"**, no "falta llenarlo".
  Nada automático debe rellenarlo al editar un perfume existente.
- `firestore.rules` **no se aplica al guardarlo**. Requiere `firebase deploy --only firestore:rules`.
- **Imágenes siempre por `cloudinary.js`** (`imgCard`, `imgCart`, `imgThumb`): nunca `src="${p.imagen}"`
  directo — descarga el original y se salta el modo ahorro.
- **Variables CSS**: usar los tokens de `variables.css`. `--surface`, `--text`, `--gold` son alias.
- **Familias olfativas en masculino** (Cítrico, Amaderado, Marino): los perfumes guardan el nombre
  exacto; una variante crea un duplicado.

## Gotchas del entorno

- El **panel del navegador no compone frames**: una transición CSS se lee congelada en su
  valor inicial. Para medir, forzar `style.transition = 'none'` antes.
- En **Windows los globs devuelven `admin\archivo.html` con backslash** — un chequeo
  `.startswith('admin/')` falla silenciosamente.
- El panel del navegador reporta **`prefers-reduced-motion: reduce`**: las animaciones que lo respetan
  no corren ahí. Para probarlas, sobreescribir `window.matchMedia` en la consola.
- **Firestore no garantiza el orden de las claves en objetos anidados** (`lotes`, `precios`): comparar
  con `JSON.stringify` da "distinto" entre dos lecturas idénticas. Para verificar, ordenar claves en
  todos los niveles. Y guardar el estado previo en `window`, no en `const` (no sobrevive entre llamadas).
- **Heredocs largos fallan en esta shell** (~130+ líneas): escribir el script a un archivo y ejecutarlo.
- Los **errores viejos de consola persisten** en el panel citando `?v=` que ya no se cargan.
  Confirma la versión real antes de creerles.

---

# Uso de modelos y de contexto

El modelo de la sesión principal lo elige Rodolfo en el selector de la app; esto no lo
cambia un archivo. Lo que sí se controla desde aquí es **a qué subagente se delega**, y
cada subagente tiene su modelo fijado en `.claude/agents/`.

## Cuándo delegar

| Tarea | Subagente | Modelo |
|---|---|---|
| "¿Dónde está X?", "¿qué archivo maneja Y?", barrido por varios archivos | `buscador` | Haiku |
| Correr tests / lint / sintaxis y reportar solo lo que falla | `verificador` | Haiku |
| Revisar un cambio ya hecho buscando bugs | `revisor` | Sonnet |
| Diseñar un cambio que toca varios archivos grandes | `arquitecto` | Opus |
| Escribir o editar el código | — | sesión principal |

## Cuándo NO delegar

Delegar tiene costo fijo: el subagente arranca en frío y vuelve a derivar el contexto.

- **Si ya sabes el archivo y la línea, edita directo.** No mandes un subagente a confirmar
  lo que ya está en contexto.
- **Si la respuesta cabe en un `grep`**, corre el `grep`. Un subagente para eso cuesta más.
- **Nunca delegues una edición de una sola línea.**

La ganancia real de Haiku está en lo que **no** entra al contexto principal: barridos que
leerían diez archivos, o salidas de Jest de cientos de líneas cuando solo importa si pasó.

## Disciplina de contexto

1. **`grep -n` antes de `cat`.** Leer un archivo completo es último recurso.
2. **Leer por rangos** (`sed -n '120,190p'`), no de 1 a 2000.
3. **Recortar la salida**: `| tail -20`, `| head -30`, `--short`, `--oneline`.
4. **Llamadas independientes en paralelo**, en un solo mensaje.
5. **No releer un archivo recién editado para "verificar"** — si el edit falló, avisa solo.
6. **No repetir de vuelta código que ya se mostró.** Describir el cambio basta.
