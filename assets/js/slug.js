/**
 * slug.js — utilidades de URL por perfume
 * Usa hash routing (#/perfumes/slug) para compatibilidad con GitHub Pages.
 */

/**
 * toSlug('Jean Lowe Summer Vibes') → 'jean-lowe-summer-vibes'
 */
export function toSlug(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * perfumeURL(p) → '#/perfumes/hawas-london'
 */
export function perfumeURL(p) {
  const base = [p.marca, p.nombre].filter(Boolean).join(' ');
  return '#/perfumes/' + toSlug(base);
}

/** slugDe(p) → 'rasasi-hawas-london' (marca + nombre). */
export function slugDe(p) {
  return toSlug([p && p.marca, p && p.nombre].filter(Boolean).join(' '));
}

/**
 * Cada perfume tiene su propia página: rutaProducto(p) → 'producto.html?p=rasasi-hawas-london'.
 * Antes la ficha era un modal con hash (#/perfumes/...); esos links viejos se
 * redirigen a esta página (ver catalog.js).
 */
export function rutaProducto(p) {
  return 'producto.html?p=' + encodeURIComponent(slugDe(p));
}

/** Carpeta del sitio a partir de una URL: '.../decants/producto.html?p=x' → '.../decants/'. */
export function carpetaDe(href) {
  return new URL('.', href).href;
}

/** El slug que trae la página de producto: '?p=rasasi-hawas-london' → 'rasasi-hawas-london'. */
export function slugDeBusqueda(search) {
  return new URLSearchParams(search || '').get('p') || null;
}

/** perfumeFullURL(p) → 'https://rodolfohubster.github.io/decants/producto.html?p=hawas-london' */
export function perfumeFullURL(p) {
  return carpetaDe(window.location.href) + rutaProducto(p);
}

/**
 * getSlugFromHash() → 'hawas-london' | null
 * Lee el slug del hash actual: #/perfumes/hawas-london
 */
export function getSlugFromHash() {
  const match = window.location.hash.match(/^#\/perfumes\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * findBySlug(all, slug) → perfume | undefined
 */
export function findBySlug(all, slug) {
  if (!slug) return undefined;
  return all.find(p => {
    const base = [p.marca, p.nombre].filter(Boolean).join(' ');
    return toSlug(base) === slug;
  });
}
