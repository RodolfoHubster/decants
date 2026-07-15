/**
 * novedades-modal.js
 * Modal público de Novedades para index.html
 *
 * Fix 1 — Persistencia real con localStorage + timestamp.
 * Fix 2 — Carrusel multi-novedad con dots + flechas + swipe.
 * Fix 3 — Layout: altura mínima consistente, slides bien contenidos.
 */
import { db, collection, getDocs, query, where, doc, getDoc }
  from './firebase-config.js';

const LS_PREFIX = 'fitoscents_nov_visto_';

// ─── Estilos ──────────────────────────────────────────────────────────────────
(function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
  #nov-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.72);
    z-index: 1100;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    opacity: 0; pointer-events: none;
    transition: opacity .3s cubic-bezier(.16,1,.3,1);
  }
  #nov-overlay.open { opacity: 1; pointer-events: auto; }

  #nov-box {
    background: #141210;
    border: 1px solid rgba(201,168,76,.35);
    border-radius: 20px;
    width: 100%; max-width: 480px;
    /* Altura fija: el modal siempre ocupa el mismo espacio sin importar el slide */
    height: min(560px, calc(100dvh - 32px));
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,.7);
    transform: translateY(18px) scale(.97);
    transition: transform .35s cubic-bezier(.16,1,.3,1);
  }
  #nov-overlay.open #nov-box { transform: translateY(0) scale(1); }

  /* ── Header ── */
  .nov-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px solid rgba(255,255,255,.07);
    flex-shrink: 0;
    gap: 12px;
  }
  .nov-header-left { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
  .nov-badge {
    background: rgba(201,168,76,.18);
    border: 1px solid rgba(201,168,76,.4);
    border-radius: 99px; padding: 3px 10px;
    font-size: 10px; font-weight: 700;
    color: #c9a84c; letter-spacing: .06em;
    text-transform: uppercase;
    width: fit-content;
  }
  .nov-titulo {
    font-family: 'Playfair Display', serif;
    font-size: 17px; font-weight: 600;
    color: #ede9e1; line-height: 1.3;
    word-break: break-word;
  }
  .nov-close {
    width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.08);
    color: #8a8880; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all .15s;
  }
  .nov-close:hover { background: rgba(255,255,255,.12); color: #ede9e1; }

  /* ── Carrusel: ocupa todo el espacio disponible entre header y footer ── */
  .nov-carousel {
    flex: 1;
    /* overflow hidden aqui para que solo se vea 1 slide a la vez */
    overflow: hidden;
    position: relative;
  }
  /* El track se mueve horizontalmente con transform */
  .nov-slides-wrap {
    display: flex;
    height: 100%;          /* ocupa toda la altura del carrusel */
    transition: transform .38s cubic-bezier(.16,1,.3,1);
  }
  /* Cada slide: ancho fijo 100%, scroll vertical interno */
  .nov-slide {
    min-width: 100%; width: 100%;
    flex-shrink: 0;
    height: 100%;          /* igual altura en todos los slides */
    overflow-y: auto;
    padding: 18px 20px;
    display: flex; flex-direction: column; gap: 14px;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
  }
  .nov-mensaje {
    font-size: 14px; line-height: 1.75;
    color: #aba89e; white-space: pre-wrap;
  }

  /* ── Perfumes dentro del slide ── */
  .nov-perfs-title {
    font-size: 11px; font-weight: 700;
    color: #c9a84c; letter-spacing: .07em;
    text-transform: uppercase;
  }
  .nov-perfs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }
  .nov-pcard {
    background: #1e1c18;
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 12px; overflow: hidden;
    cursor: pointer;
    transition: border-color .18s, transform .18s;
    display: flex; flex-direction: column;
  }
  .nov-pcard:hover { border-color: rgba(201,168,76,.4); transform: translateY(-2px); }
  .nov-pcard-img {
    width: 100%; aspect-ratio: 1/1;
    background: #252320;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .nov-pcard-img img { width: 100%; height: 100%; object-fit: cover; }
  .nov-no-img { font-size: 26px; color: rgba(201,168,76,.3); }
  .nov-pcard-info { padding: 8px 10px 10px; }
  .nov-pcard-marca {
    font-size: 10px; color: #8a8880;
    text-transform: uppercase; letter-spacing: .06em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .nov-pcard-nombre {
    font-size: 12px; font-weight: 600; color: #ede9e1;
    line-height: 1.3; margin: 2px 0 6px;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
  }
  .nov-pcard-btn {
    width: 100%; padding: 6px 8px;
    background: rgba(201,168,76,.15);
    border: 1px solid rgba(201,168,76,.3);
    border-radius: 7px;
    color: #c9a84c; font-size: 11px; font-weight: 700;
    font-family: 'Poppins', sans-serif; cursor: pointer;
    transition: background .15s;
  }
  .nov-pcard-btn:hover { background: rgba(201,168,76,.28); }

  /* ── Barra de navegación (solo si >1 novedad) ── */
  .nov-nav {
    display: flex; align-items: center; justify-content: center;
    gap: 10px; padding: 8px 20px 6px;
    border-top: 1px solid rgba(255,255,255,.07);
    flex-shrink: 0;
  }
  .nov-nav-btn {
    width: 30px; height: 30px; border-radius: 8px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.08);
    color: #8a8880; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all .15s;
  }
  .nov-nav-btn:hover:not(:disabled) { background: rgba(255,255,255,.14); color: #ede9e1; }
  .nov-nav-btn:disabled { opacity: .3; cursor: default; }
  .nov-dots { display: flex; gap: 6px; align-items: center; }
  .nov-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: rgba(255,255,255,.18);
    border: none;
    transition: background .2s, transform .2s;
    cursor: pointer; padding: 0;
  }
  .nov-dot.active { background: #c9a84c; transform: scale(1.35); }
  .nov-counter {
    font-size: 11px; color: #8a8880;
    font-family: 'Poppins', sans-serif;
    min-width: 32px; text-align: center;
  }

  /* ── Footer ── */
  .nov-footer {
    padding: 10px 20px 14px;
    border-top: 1px solid rgba(255,255,255,.07);
    flex-shrink: 0;
  }
  .nov-btn-close-all {
    width: 100%; padding: 13px;
    background: rgba(201,168,76,.12);
    border: 1px solid rgba(201,168,76,.28);
    border-radius: 12px;
    color: #c9a84c; font-size: 14px; font-weight: 600;
    font-family: 'Poppins', sans-serif; cursor: pointer;
    transition: background .15s;
  }
  .nov-btn-close-all:hover { background: rgba(201,168,76,.22); }

  /* ── FAB ── */
  #nov-fab {
    position: fixed; bottom: 84px; right: 20px;
    background: #c9a84c; color: #000;
    border: none; border-radius: 50%;
    width: 46px; height: 46px; font-size: 20px;
    display: none; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(201,168,76,.35);
    cursor: pointer; z-index: 300;
    transition: transform .2s, box-shadow .2s;
    animation: pulse-nov 2.8s ease-in-out infinite;
  }
  #nov-fab.visible { display: flex; }
  @keyframes pulse-nov {
    0%,100% { box-shadow: 0 6px 20px rgba(201,168,76,.3); }
    50%      { box-shadow: 0 6px 32px rgba(201,168,76,.6); }
  }
  #nov-fab:hover { transform: scale(1.1); }
  #nov-fab[title]:hover::before {
    content: attr(title);
    position: absolute; right: calc(100% + 8px); top: 50%;
    transform: translateY(-50%);
    background: #1e1c18; border: 1px solid rgba(255,255,255,.1);
    color: #ede9e1; font-size: 12px; white-space: nowrap;
    padding: 5px 10px; border-radius: 7px;
    font-family: 'Poppins', sans-serif; pointer-events: none;
  }
  body.cart-open #nov-fab { opacity: 0; pointer-events: none; }
  `;
  document.head.appendChild(style);
})();

// ─── Persistencia localStorage ───────────────────────────────────────────────────
function yaVisto(nov) {
  const key = LS_PREFIX + nov.id;
  return localStorage.getItem(key) !== null;
}
function marcarVisto(nov) {
  localStorage.setItem(LS_PREFIX + nov.id, String(Date.now()));
}

// ─── Expiración de novedad (por fecha de creación) ────────────────────────────
function isExpired(nov) {
  if (!nov.duracionDias || nov.duracionDias <= 0) return false;
  const creado = nov.creadoEn?.toDate ? nov.creadoEn.toDate() : new Date(nov.creadoEn);
  return Date.now() > creado.getTime() + nov.duracionDias * 86400000;
}

// ─── Construir slide de una novedad ──────────────────────────────────────────
async function buildSlideDOM(nov) {
  const slide = document.createElement('div');
  slide.className = 'nov-slide';

  if (nov.mensaje) {
    const msgEl = document.createElement('p');
    msgEl.className = 'nov-mensaje';
    msgEl.textContent = nov.mensaje;
    slide.appendChild(msgEl);
  }

  if (nov.perfumeIds?.length) {
    const titleEl = document.createElement('div');
    titleEl.className = 'nov-perfs-title';
    titleEl.textContent = '✨ Perfumes destacados';
    slide.appendChild(titleEl);

    const grid = document.createElement('div');
    grid.className = 'nov-perfs-grid';
    slide.appendChild(grid);

    const perfumesData = await Promise.all(
      nov.perfumeIds.map(id =>
        getDoc(doc(db, 'perfumes', id)).then(d => d.exists() ? { id: d.id, ...d.data() } : null)
      )
    );

    perfumesData.filter(Boolean).forEach(p => {
      const card = document.createElement('div');
      card.className = 'nov-pcard';
      const vals = Object.values(p.precios || {}).map(Number).filter(v => v > 0);
      const min  = vals.length ? Math.min(...vals) : null;
      card.innerHTML = `
        <div class="nov-pcard-img">
          ${p.imagen
            ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy">`
            : '<div class="nov-no-img"><i class="bi bi-droplet"></i></div>'}
        </div>
        <div class="nov-pcard-info">
          <div class="nov-pcard-marca">${p.marca || ''}</div>
          <div class="nov-pcard-nombre">${p.nombre}</div>
          <button class="nov-pcard-btn">${min ? 'Desde $' + min : 'Ver perfume'} →</button>
        </div>
      `;
      card.addEventListener('click', () => {
        document.getElementById('nov-overlay').classList.remove('open');
        document.body.style.overflow = '';
        if (typeof window.openModal === 'function') {
          setTimeout(() => window.openModal(p.id), 180);
        }
      });
      grid.appendChild(card);
    });
  }

  return slide;
}

// ─── Construir DOM del modal ───────────────────────────────────────────────────
function buildDOM() {
  const overlay = document.createElement('div');
  overlay.id = 'nov-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Novedades');
  overlay.innerHTML = `
    <div id="nov-box">
      <div class="nov-header">
        <div class="nov-header-left">
          <span class="nov-badge">🆕 Novedad</span>
          <div class="nov-titulo" id="nov-titulo"></div>
        </div>
        <button class="nov-close" id="nov-close-btn" aria-label="Cerrar">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="nov-carousel">
        <div class="nov-slides-wrap" id="nov-slides-wrap"></div>
      </div>

      <div class="nov-nav" id="nov-nav" style="display:none">
        <button class="nov-nav-btn" id="nov-prev" aria-label="Anterior">
          <i class="bi bi-chevron-left"></i>
        </button>
        <div class="nov-dots" id="nov-dots"></div>
        <span class="nov-counter" id="nov-counter"></span>
        <button class="nov-nav-btn" id="nov-next" aria-label="Siguiente">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>

      <div class="nov-footer">
        <button class="nov-btn-close-all" id="nov-btn-close-all">Entendido 👍</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fab = document.createElement('button');
  fab.id = 'nov-fab';
  fab.title = 'Ver novedades';
  fab.setAttribute('aria-label', 'Ver novedades');
  fab.innerHTML = '🆕';
  document.body.appendChild(fab);

  return { overlay, fab };
}

// ─── Lógica de carrusel ────────────────────────────────────────────────────────
function initCarousel(novedades) {
  const wrap    = document.getElementById('nov-slides-wrap');
  const nav     = document.getElementById('nov-nav');
  const dotsEl  = document.getElementById('nov-dots');
  const counter = document.getElementById('nov-counter');
  const prevBtn = document.getElementById('nov-prev');
  const nextBtn = document.getElementById('nov-next');
  const titulo  = document.getElementById('nov-titulo');
  const total   = novedades.length;
  let current   = 0;

  function goTo(idx) {
    current = idx;
    marcarVisto(novedades[current]);
    wrap.style.transform = `translateX(-${current * 100}%)`;
    titulo.textContent = novedades[current].titulo || 'Novedades';
    if (counter) counter.textContent = `${current + 1} / ${total}`;
    dotsEl.querySelectorAll('.nov-dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) nextBtn.disabled = current === total - 1;
  }

  if (total > 1) {
    nav.style.display = 'flex';
    novedades.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'nov-dot';
      dot.setAttribute('aria-label', `Novedad ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsEl.appendChild(dot);
    });
    prevBtn.addEventListener('click', () => { if (current > 0) goTo(current - 1); });
    nextBtn.addEventListener('click', () => { if (current < total - 1) goTo(current + 1); });
  }

  goTo(0);

  // Swipe táctil
  let startX = 0;
  wrap.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && current < total - 1) goTo(current + 1);
      else if (diff < 0 && current > 0)    goTo(current - 1);
    }
  });
}

// ─── Init principal ────────────────────────────────────────────────────────────
export async function initNovedadesModal() {
  try {
    const snap = await getDocs(query(
      collection(db, 'novedades'),
      where('activo', '==', true)
    ));

    const novedades = [];
    snap.forEach(d => {
      const data = { id: d.id, ...d.data() };
      if (!isExpired(data)) novedades.push(data);
    });

    if (!novedades.length) return;

    const { overlay, fab } = buildDOM();

    // Construir todos los slides y añadirlos al track
    const wrap   = document.getElementById('nov-slides-wrap');
    const slides = await Promise.all(novedades.map(n => buildSlideDOM(n)));
    slides.forEach(s => wrap.appendChild(s));

    initCarousel(novedades);

    // Cierre
    function closeModal() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    document.getElementById('nov-close-btn').addEventListener('click', closeModal);
    document.getElementById('nov-btn-close-all').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
    });
    fab.addEventListener('click', () => {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    });

    fab.classList.add('visible');

    // Abrir auto solo si hay al menos una novedad no vista
    const hayNoVista = novedades.some(n => !yaVisto(n));
    if (hayNoVista) {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

  } catch (err) {
    console.warn('[novedades-modal]', err);
  }
}
