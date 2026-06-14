/**
 * novedades-modal.js
 * Modal público de Novedades para index.html
 * - Abre automáticamente si hay novedad activa y vigente
 * - No vuelve a aparecer hasta que haya un ID diferente (sessionStorage)
 * - Botón flotante 🆕 para reabrirlo manualmente
 */
import { db, collection, getDocs, query, where, doc, getDoc }
  from './firebase-config.js';

const SEEN_KEY = 'fitoscents_novedad_vista';

// ─── Inyectar estilos ────────────────────────────────────────────────────────
(function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
  /* ══ Modal Novedades ══════════════════════════════════════════════════ */
  #nov-overlay {
    position:fixed; inset:0;
    background:rgba(0,0,0,.72);
    z-index:1100;
    display:flex; align-items:center; justify-content:center;
    padding:16px;
    opacity:0; pointer-events:none;
    transition:opacity .3s cubic-bezier(.16,1,.3,1);
  }
  #nov-overlay.open { opacity:1; pointer-events:auto; }

  #nov-box {
    background:#141210;
    border:1px solid rgba(201,168,76,.35);
    border-radius:20px;
    width:100%; max-width:480px;
    max-height:calc(100dvh - 32px);
    overflow:hidden;
    display:flex; flex-direction:column;
    box-shadow:0 24px 64px rgba(0,0,0,.7);
    transform:translateY(18px) scale(.97);
    transition:transform .35s cubic-bezier(.16,1,.3,1);
  }
  #nov-overlay.open #nov-box { transform:translateY(0) scale(1); }

  .nov-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:18px 20px 14px;
    border-bottom:1px solid rgba(255,255,255,.07);
    flex-shrink:0;
  }
  .nov-header-left { display:flex; align-items:center; gap:10px; }
  .nov-badge {
    background:rgba(201,168,76,.18);
    border:1px solid rgba(201,168,76,.4);
    border-radius:99px; padding:4px 12px;
    font-size:11px; font-weight:700;
    color:#c9a84c; letter-spacing:.06em;
    text-transform:uppercase;
  }
  .nov-titulo {
    font-family:'Playfair Display',serif;
    font-size:16px; font-weight:600;
    color:#ede9e1; line-height:1.3;
    max-width:280px;
  }
  .nov-close {
    width:34px; height:34px; border-radius:8px;
    background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.08);
    color:#8a8880; font-size:18px;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:all .15s; flex-shrink:0;
  }
  .nov-close:hover { background:rgba(255,255,255,.12); color:#ede9e1; }

  .nov-body {
    flex:1; overflow-y:auto; padding:16px 20px;
    display:flex; flex-direction:column; gap:14px;
    -webkit-overflow-scrolling:touch;
  }
  .nov-mensaje {
    font-size:14px; line-height:1.7;
    color:#aba89e; white-space:pre-wrap;
  }

  /* Tarjetas de perfume */
  .nov-perfs-title {
    font-size:11px; font-weight:700;
    color:#c9a84c; letter-spacing:.07em;
    text-transform:uppercase;
    margin-bottom:4px;
  }
  .nov-perfs-grid {
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(130px,1fr));
    gap:10px;
  }
  .nov-pcard {
    background:#1e1c18;
    border:1px solid rgba(255,255,255,.07);
    border-radius:12px; overflow:hidden;
    cursor:pointer;
    transition:border-color .18s, transform .18s;
    display:flex; flex-direction:column;
  }
  .nov-pcard:hover {
    border-color:rgba(201,168,76,.4);
    transform:translateY(-2px);
  }
  .nov-pcard-img {
    width:100%; aspect-ratio:1/1;
    background:#252320;
    display:flex; align-items:center; justify-content:center;
    overflow:hidden;
  }
  .nov-pcard-img img { width:100%; height:100%; object-fit:cover; }
  .nov-pcard-img .nov-no-img {
    font-size:26px; color:rgba(201,168,76,.3);
  }
  .nov-pcard-info { padding:8px 10px 10px; }
  .nov-pcard-marca {
    font-size:10px; color:#8a8880;
    text-transform:uppercase; letter-spacing:.06em;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .nov-pcard-nombre {
    font-size:12px; font-weight:600; color:#ede9e1;
    line-height:1.3; margin:2px 0 6px;
    display:-webkit-box; -webkit-line-clamp:2;
    -webkit-box-orient:vertical; overflow:hidden;
  }
  .nov-pcard-btn {
    width:100%; padding:6px 8px;
    background:rgba(201,168,76,.15);
    border:1px solid rgba(201,168,76,.3);
    border-radius:7px;
    color:#c9a84c; font-size:11px; font-weight:700;
    font-family:'Poppins',sans-serif; cursor:pointer;
    transition:background .15s;
  }
  .nov-pcard-btn:hover { background:rgba(201,168,76,.28); }

  .nov-footer {
    padding:12px 20px 16px;
    border-top:1px solid rgba(255,255,255,.07);
    flex-shrink:0;
  }
  .nov-btn-close-all {
    width:100%; padding:13px;
    background:rgba(201,168,76,.12);
    border:1px solid rgba(201,168,76,.28);
    border-radius:12px;
    color:#c9a84c; font-size:14px; font-weight:600;
    font-family:'Poppins',sans-serif; cursor:pointer;
    transition:background .15s;
  }
  .nov-btn-close-all:hover { background:rgba(201,168,76,.22); }

  /* ── Botón flotante 🆕 ───────────────────────────────────────────────── */
  #nov-fab {
    position:fixed; bottom:84px; right:20px;
    background:#c9a84c; color:#000;
    border:none; border-radius:50%;
    width:46px; height:46px; font-size:20px;
    display:none; align-items:center; justify-content:center;
    box-shadow:0 6px 20px rgba(201,168,76,.35);
    cursor:pointer; z-index:300;
    transition:transform .2s, box-shadow .2s;
    animation:pulse-nov 2.8s ease-in-out infinite;
  }
  #nov-fab.visible { display:flex; }
  @keyframes pulse-nov {
    0%,100% { box-shadow:0 6px 20px rgba(201,168,76,.3); }
    50%      { box-shadow:0 6px 32px rgba(201,168,76,.6); }
  }
  #nov-fab:hover { transform:scale(1.1); }
  #nov-fab[title]:hover::before {
    content:attr(title);
    position:absolute; right:calc(100% + 8px); top:50%;
    transform:translateY(-50%);
    background:#1e1c18; border:1px solid rgba(255,255,255,.1);
    color:#ede9e1; font-size:12px; white-space:nowrap;
    padding:5px 10px; border-radius:7px;
    font-family:'Poppins',sans-serif; pointer-events:none;
  }
  body.cart-open #nov-fab { opacity:0; pointer-events:none; }
  `;
  document.head.appendChild(style);
})();

// ─── DOM ─────────────────────────────────────────────────────────────────────
function buildDOM() {
  // Overlay + box
  const overlay = document.createElement('div');
  overlay.id = 'nov-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Novedades');
  overlay.innerHTML = `
    <div id="nov-box">
      <div class="nov-header">
        <div class="nov-header-left">
          <div class="nov-titulo" id="nov-titulo"></div>
        </div>
        <button class="nov-close" id="nov-close-btn" aria-label="Cerrar">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="nov-body" id="nov-body"></div>
      <div class="nov-footer">
        <button class="nov-btn-close-all" id="nov-btn-close-all">Entendido 👍</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // FAB
  const fab = document.createElement('button');
  fab.id = 'nov-fab';
  fab.title = 'Ver novedades';
  fab.setAttribute('aria-label', 'Ver novedades');
  fab.innerHTML = '🆕';
  document.body.appendChild(fab);

  // Eventos de cierre
  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.getElementById('nov-close-btn').addEventListener('click', closeModal);
  document.getElementById('nov-btn-close-all').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });

  // FAB abre modal
  fab.addEventListener('click', () => {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  return { overlay, fab };
}

// ─── Render perfumes ──────────────────────────────────────────────────────────
async function renderPerfumes(ids, bodyEl) {
  if (!ids || !ids.length) return;
  const wrapTitle = document.createElement('div');
  wrapTitle.className = 'nov-perfs-title';
  wrapTitle.textContent = '✨ Perfumes destacados';
  bodyEl.appendChild(wrapTitle);

  const grid = document.createElement('div');
  grid.className = 'nov-perfs-grid';
  bodyEl.appendChild(grid);

  // Cargar datos de cada perfume
  const perfumesData = await Promise.all(
    ids.map(id => getDoc(doc(db, 'perfumes', id)).then(d => d.exists() ? { id: d.id, ...d.data() } : null))
  );

  perfumesData.filter(Boolean).forEach(p => {
    const card = document.createElement('div');
    card.className = 'nov-pcard';
    const minPrecio = Math.min(...Object.values(p.precios || {}).map(Number).filter(v => v > 0));
    card.innerHTML = `
      <div class="nov-pcard-img">
        ${p.imagen
          ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy">`
          : '<div class="nov-no-img"><i class="bi bi-droplet"></i></div>'}
      </div>
      <div class="nov-pcard-info">
        <div class="nov-pcard-marca">${p.marca || ''}</div>
        <div class="nov-pcard-nombre">${p.nombre}</div>
        <button class="nov-pcard-btn">
          ${minPrecio < 9999 ? 'Desde $' + minPrecio : 'Ver perfume'} →
        </button>
      </div>
    `;
    card.addEventListener('click', () => {
      // Cerrar modal novedades y abrir modal del perfume
      document.getElementById('nov-overlay').classList.remove('open');
      document.body.style.overflow = '';
      if (typeof window.openModal === 'function') {
        setTimeout(() => window.openModal(p.id), 180);
      }
    });
    grid.appendChild(card);
  });
}

// ─── Verificar si novedad expiró ─────────────────────────────────────────────
function isExpired(nov) {
  if (!nov.duracionDias || nov.duracionDias <= 0) return false;
  const creado = nov.creadoEn?.toDate ? nov.creadoEn.toDate() : new Date(nov.creadoEn);
  const expira = new Date(creado.getTime() + nov.duracionDias * 86400000);
  return new Date() > expira;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initNovedadesModal() {
  try {
    // Buscar novedades activas
    const snap = await getDocs(query(
      collection(db, 'novedades'),
      where('activo', '==', true)
    ));

    let novedad = null;
    snap.forEach(d => {
      const data = { id: d.id, ...d.data() };
      if (!isExpired(data)) novedad = data; // toma la última activa no expirada
    });

    if (!novedad) return; // sin novedad activa

    const { overlay, fab } = buildDOM();

    // Renderizar contenido
    document.getElementById('nov-titulo').textContent = novedad.titulo || 'Novedades';
    const bodyEl = document.getElementById('nov-body');

    if (novedad.mensaje) {
      const msgEl = document.createElement('p');
      msgEl.className = 'nov-mensaje';
      msgEl.textContent = novedad.mensaje;
      bodyEl.appendChild(msgEl);
    }

    if (novedad.perfumeIds?.length) {
      await renderPerfumes(novedad.perfumeIds, bodyEl);
    }

    // Mostrar FAB siempre
    fab.classList.add('visible');

    // Abrir automáticamente solo si es nueva (distinto ID al guardado)
    const seenId = sessionStorage.getItem(SEEN_KEY);
    if (seenId !== novedad.id) {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      sessionStorage.setItem(SEEN_KEY, novedad.id);
    }
  } catch (err) {
    console.warn('[novedades-modal]', err);
  }
}
