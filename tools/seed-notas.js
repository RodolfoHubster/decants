/**
 * seed-notas.js — Carga masiva de familias olfativas y tipos de perfume.
 *
 * CÓMO USARLO:
 *   1. Abre http://localhost:5501/admin/notas.html y asegúrate de estar logueado.
 *   2. Abre la consola del navegador (F12 → Console).
 *   3. Pega TODO este archivo y dale Enter.
 *
 * Es idempotente y no borra nada: si ya existe una familia o tipo equivalente,
 * lo salta. "Equivalente" incluye variantes de escritura que ya están en uso
 * (Cítrico/Cítrica, Marino/Acuático, Fougere/Fougère, Cologne/Eau de Cologne),
 * porque los perfumes guardan el nombre exacto y un duplicado los partiría.
 *
 * Los nombres siguen la convención que ya existe en la base: forma masculina
 * (Amaderado, Cítrico, Aromático…).
 */
(async () => {
  const { db, collection, getDocs, addDoc } =
    await import('/assets/js/firebase-config.js');

  const FAMILIAS = [
    { nombre: 'Especiado',   emoji: '🌶️', descripcion: 'Canela, cardamomo, pimienta, clavo. Cálido y picante.',      orden: 100 },
    { nombre: 'Verde',       emoji: '🌿', descripcion: 'Hojas, pasto cortado, gálbano. Herbal y natural.',           orden: 110 },
    { nombre: 'Chipre',      emoji: '🍂', descripcion: 'Bergamota, musgo de roble, pachulí. Elegante y seco.',       orden: 120 },
    { nombre: 'Cuero',       emoji: '🧤', descripcion: 'Piel, abedul, suede. Animal y sofisticado.',                 orden: 130 },
    { nombre: 'Tabaco',      emoji: '🍂', descripcion: 'Hoja de tabaco, miel, ron. Cálido y adictivo.',              orden: 140 },
    { nombre: 'Almizclado',  emoji: '🤍', descripcion: 'Musk blanco, piel limpia. Suave y envolvente.',              orden: 150 },
    { nombre: 'Aldehídico',  emoji: '✨', descripcion: 'Aldehídos jabonosos. El efecto Chanel Nº5.',                  orden: 160 },
    { nombre: 'Incienso',    emoji: '🕯️', descripcion: 'Olíbano, mirra, humo. Místico y ceremonial.',               orden: 170 },
  ];

  const TIPOS = [
    { nombre: 'Elixir',            emoji: '🧪', descripcion: '15–30%. Versión intensificada de una fragancia.',        orden: 15 },
    { nombre: 'Parfum Intense',    emoji: '🔥', descripcion: 'EDP reforzado: más proyección que el original.',          orden: 35 },
    { nombre: 'Eau Fraîche',       emoji: '❄️', descripcion: '1–3%. La más ligera de todas.',                           orden: 70 },
    { nombre: 'Attar / Aceite',    emoji: '🫗', descripcion: 'Aceite puro sin alcohol. Típico en perfumería árabe.',    orden: 80 },
    { nombre: 'Body Mist',         emoji: '🌬️', descripcion: '1–2%. Bruma corporal, duración corta.',                   orden: 90 },
    { nombre: 'Hair Mist',         emoji: '💇', descripcion: 'Formulada para el cabello, sin resecar.',                  orden: 100 },
  ];

  // Variantes que cuentan como "ya existe".
  const ALIAS = {
    'citrica': 'citrico', 'amaderada': 'amaderado', 'aromatica': 'aromatico',
    'acuatica': 'marino', 'acuatico': 'marino', 'especiada': 'especiado',
    'almizclada': 'almizclado', 'aldehidica': 'aldehidico',
    'orientalambar': 'oriental', 'ambar': 'oriental', 'ambarado': 'oriental',
    'eaudecologne': 'cologne', 'edc': 'cologne', 'edp': 'eaudeparfum', 'edt': 'eaudetoilette',
  };
  const clave = t => {
    const k = (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return ALIAS[k] || k;
  };

  async function sembrar(col, datos) {
    const snap = await getDocs(collection(db, col));
    const existentes = new Set(snap.docs.map(d => clave(d.data().nombre)));
    let nuevos = 0, saltados = 0;
    for (const item of datos) {
      if (existentes.has(clave(item.nombre))) { saltados++; continue; }
      await addDoc(collection(db, col), item);
      existentes.add(clave(item.nombre));
      nuevos++;
    }
    console.log(`${col}: ${nuevos} agregados, ${saltados} ya existían.`);
    return { nuevos, saltados };
  }

  try {
    const f = await sembrar('familias_olfativas', FAMILIAS);
    const t = await sembrar('tipos_perfume', TIPOS);
    console.log('Listo. Recarga notas.html para verlos.');
    return { familias: f, tipos: t };
  } catch (e) {
    console.error('Falló:', e.message, '— ¿estás logueado en el admin?');
    return { error: e.message };
  }
})();
