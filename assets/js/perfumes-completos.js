import { db } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { toast } from './toast.js';

renderSidebar('perfumes-completos');

const CLOUD_NAME = 'dxo761td7';
const UPLOAD_PRESET = 'FITOSCENTS-DECANTS';
const COL = 'perfumes_completos';

let items = [];
let imgMode = 'url';
let currentTab = 'activos';

// ── Cargar datos ──────────────────────────────────────────
async function load() {
  const snap = await getDocs(collection(db, COL));
  items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTable();
}

// ── Render tabla ──────────────────────────────────────────
window.renderTable = function () {
  const q   = document.getElementById('search').value.toLowerCase();
  const gen = document.getElementById('f-genero').value;
  const con = document.getElementById('f-concentracion').value;
  const dis = document.getElementById('f-disponibilidad').value;

  const filtered = items.filter(p => {
    const txt = `${p.nombre} ${p.marca}`.toLowerCase();
    const isAgotado = p.disponibilidad === 'agotado';
    const isActivo = p.activo !== false;

    if (currentTab === 'activos') {
      if (!isActivo || isAgotado) return false;
    } else {
      if (isActivo && !isAgotado) return false;
    }

    return (!q || txt.includes(q))
        && (!gen || p.genero === gen)
        && (!con || p.concentracion === con)
        && (!dis || p.disponibilidad === dis);
  });

  document.getElementById('count-label').textContent = `${filtered.length} perfume${filtered.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted,#888)"><i class="bi bi-bag-heart" style="font-size:28px;display:block;margin-bottom:8px"></i>No se encontraron perfumes completos</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const precios = buildPreciosHTML(p.precios || {});
    const dispClass = p.disponibilidad === 'en-stock' ? 'en-stock' : p.disponibilidad === 'bajo-pedido' ? 'bajo-pedido' : 'agotado';
    const dispLabel = p.disponibilidad === 'en-stock' ? '<i class="bi bi-check-circle-fill"></i> En Stock' : p.disponibilidad === 'bajo-pedido' ? '<i class="bi bi-clock"></i> Bajo Pedido' : '<i class="bi bi-x-circle-fill"></i> Agotado';
    const archiveBtn = p.activo !== false
      ? `<button class="btn btn-sm btn-outline" onclick="toggleActivo('${p.id}', false)" title="Archivar (Ocultar)"><i class="bi bi-eye-slash"></i></button>`
      : `<button class="btn btn-sm btn-outline" style="color:var(--accent)" onclick="toggleActivo('${p.id}', true)" title="Desarchivar (Mostrar)"><i class="bi bi-eye"></i></button>`;

    return `<tr>
      <td><img src="${p.imagen || ''}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px;background:#222" onerror="this.src=''"></td>
      <td style="font-weight:500">${p.nombre || '—'}</td>
      <td>${p.marca || '—'}</td>
      <td><span class="concentracion-badge">${p.concentracion || '—'}</span></td>
      <td>${p.genero || '—'}</td>
      <td><span class="stock-badge ${dispClass}">${dispLabel}</span></td>
      <td style="font-size:12px">${precios}</td>
      <td>
        <div style="display:flex;gap:4px">
          ${archiveBtn}
          <button class="btn btn-sm btn-outline" onclick='edit(${JSON.stringify(p.id)})'><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline" style="color:#ef4444" onclick='remove(${JSON.stringify(p.id)})'><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

function buildPreciosHTML(precios) {
  const map = {px30:'30ml',px50:'50ml',px75:'75ml',px100:'100ml',px150:'150ml',px200:'200ml'};
  return Object.entries(map)
    .filter(([k]) => precios[k] && precios[k] > 0)
    .map(([k, lbl]) => `<span style="white-space:nowrap">${lbl}: $${Number(precios[k]).toLocaleString()}</span>`)
    .join('<br>') || '—';
}

// ── Modal ─────────────────────────────────────────────────
window.openModal = function (id = null) {
  const p = id ? items.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = p ? 'Editar Perfume' : 'Nuevo Perfume Completo';
  document.getElementById('p-id').value           = p?.id || '';
  document.getElementById('p-nombre').value       = p?.nombre || '';
  document.getElementById('p-marca').value        = p?.marca || '';
  document.getElementById('p-concentracion').value = p?.concentracion || '';
  document.getElementById('p-genero').value       = p?.genero || '';
  document.getElementById('p-original').checked   = p?.original !== false;
  document.getElementById('p-sellada').checked    = p?.sellada !== false;
  document.getElementById('p-batch').value        = p?.batch || '';
  document.getElementById('p-salida').value       = p?.notasSalida || '';
  document.getElementById('p-corazon').value      = p?.notasCorazon || '';
  document.getElementById('p-fondo').value        = p?.notasFondo || '';
  document.getElementById('p-ocasion').value      = p?.ocasion || '';
  document.getElementById('p-longevidad').value   = p?.longevidad || '';
  document.getElementById('p-proyeccion').value   = p?.proyeccion || '';
  document.getElementById('p-disponibilidad').value = p?.disponibilidad || 'en-stock';
  document.getElementById('p-tiempo').value       = p?.tiempoEstimado || '';
  document.getElementById('p-desc').value         = p?.descripcion || '';
  document.getElementById('p-logistica').value    = p?.logistica || '';
  document.getElementById('p-pago').value         = p?.pago || '';
  document.getElementById('p-barcode').value      = p?.barcode || '';
  document.getElementById('p-img-url').value      = p?.imagen || '';
  document.getElementById('p-activo').checked     = p?.activo !== false;

  const pr = p?.precios || {};
  ['30','50','75','100','150','200'].forEach(t => {
    document.getElementById(`px${t}`).value = pr[`px${t}`] || '';
  });

  document.getElementById('preview-img').src = p?.imagen || '';
  document.getElementById('preview-wrap').style.display = p?.imagen ? 'block' : 'none';

  setMode('url');
  toggleTiempo();
  document.getElementById('modal').classList.add('open');
};

window.edit = (id) => openModal(id);

window.closeModal = function () {
  document.getElementById('modal').classList.remove('open');
};

window.toggleTiempo = function () {
  const disp = document.getElementById('p-disponibilidad').value;
  document.getElementById('wrap-tiempo').style.display = disp === 'bajo-pedido' ? 'block' : 'none';
};

// ── Imagen ────────────────────────────────────────────────
window.setMode = function (mode) {
  imgMode = mode;
  document.getElementById('sec-url').style.display  = mode === 'url'  ? 'block' : 'none';
  document.getElementById('sec-file').style.display = mode === 'file' ? 'block' : 'none';
  document.getElementById('btn-url').classList.toggle('active', mode === 'url');
  document.getElementById('btn-file').classList.toggle('active', mode === 'file');
};

window.previewUrl = function () {
  const url = document.getElementById('p-img-url').value.trim();
  const wrap = document.getElementById('preview-wrap');
  document.getElementById('preview-img').src = url;
  wrap.style.display = url ? 'block' : 'none';
};

window.previewFile = function () {
  const file = document.getElementById('p-img-file').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview-wrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
};

async function uploadCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  fd.append('folder', 'perfumes-completos');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
  const json = await res.json();
  return json.secure_url;
}

// ── Guardar ───────────────────────────────────────────────
    document.getElementById('btn-ia-name')?.addEventListener('click', async () => {
        const prodTitle = document.getElementById('p-nombre').value.trim();
        if (!prodTitle) {
            toast('Por favor, escribe el nombre del perfume primero.', 'warning');
            return;
        }
        
        const geminiKey = localStorage.getItem('gemini_api_key');
        if (!geminiKey) {
            toast('Configura tu API Key en Ajustes para usar la IA.', 'warning');
            return;
        }
        
        const btn = document.getElementById('btn-ia-name');
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        btn.disabled = true;
        toast('Generando perfil olfativo con Inteligencia Artificial...', 'info');
        
        try {
            const promptText = `
Eres un experto sommelier de perfumes. 
Se te ha dado este nombre de perfume: "${prodTitle}".
Completa el siguiente JSON estrictamente y devuélvelo en formato JSON válido. 
No incluyas markdown ni explicaciones, solo el JSON puro.

{
  "title": "Nombre exacto y completo del perfume",
  "brand": "Marca diseñadora (ej. Carolina Herrera)",
  "gender": "Caballero, Dama o Unisex",
  "concentration": "EDP, EDT, Parfum, Elixir, etc",
  "salida": "Notas de salida (ej. Bergamota, Limón)",
  "corazon": "Notas de corazón (ej. Lavanda, Pimienta)",
  "fondo": "Notas de fondo (ej. Cedro, Vainilla)",
  "ocasion": "Ocasión recomendada (ej. Diario, Noche, Citas)",
  "longevity": "baja, moderada, duradera, muy-duradera o eterna",
  "sillage": "intima, moderada, pesada o enorme",
  "desc": "Descripción detallada y poética (2-3 párrafos)",
  "px30": "Precio competitivo MXN botella 30ml (0 si no aplica)",
  "px50": "Precio competitivo MXN botella 50ml (ej. 1500 diseñador, 3500 nicho. 0 si no aplica)",
  "px100": "Precio competitivo MXN botella 100ml (ej. 2500 diseñador, 5500 nicho. 0 si no aplica)",
  "px150": "Precio competitivo MXN botella 150ml (0 si no aplica)",
  "px200": "Precio competitivo MXN botella 200ml (0 si no aplica)"
}
`;
            
            const reqUrl = "https://api.openai.com/v1/chat/completions";
            const res3 = await fetch(reqUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${geminiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [{ role: "user", content: promptText }],
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                })
            });
            
            if (!res3.ok) throw new Error("Groq API falló: " + res3.statusText);
            const aiData = await res3.json();
            let aiText = aiData.choices[0].message.content;
            
            const match = aiText.match(/\{[\s\S]*\}/);
            if (match) aiText = match[0];
            
            let aiJson;
            try {
                aiJson = JSON.parse(aiText);
            } catch (err) {
                // Fallback: replace unescaped control characters
                aiText = aiText.replace(/[\u0000-\u001F]+/g, " ");
                aiJson = JSON.parse(aiText);
            }
            
            if (aiJson.brand) document.getElementById('p-marca').value = aiJson.brand;
            if (aiJson.gender && document.getElementById('p-genero')) document.getElementById('p-genero').value = aiJson.gender;
            
            if (aiJson.concentration && document.getElementById('p-concentracion')) {
                const conSelect = document.getElementById('p-concentracion');
                for (let opt of conSelect.options) {
                    if (opt.value && opt.text.toLowerCase() === aiJson.concentration.toLowerCase()) {
                        conSelect.value = opt.value; break;
                    }
                }
                if (!conSelect.value) conSelect.value = aiJson.concentration;
            }
            
            if (aiJson.salida) document.getElementById('p-salida').value = aiJson.salida;
            if (aiJson.corazon) document.getElementById('p-corazon').value = aiJson.corazon;
            if (aiJson.fondo) document.getElementById('p-fondo').value = aiJson.fondo;
            if (aiJson.ocasion) document.getElementById('p-ocasion').value = aiJson.ocasion;
            
            if (aiJson.longevity && document.getElementById('p-longevidad')) document.getElementById('p-longevidad').value = aiJson.longevity;
            if (aiJson.sillage && document.getElementById('p-proyeccion')) document.getElementById('p-proyeccion').value = aiJson.sillage;
            
            if (aiJson.desc) document.getElementById('p-desc').value = aiJson.desc;
            
            if (aiJson.px30) document.getElementById('px30').value = aiJson.px30;
            if (aiJson.px50) document.getElementById('px50').value = aiJson.px50;
            if (aiJson.px100) document.getElementById('px100').value = aiJson.px100;
            if (aiJson.px150) document.getElementById('px150').value = aiJson.px150;
            if (aiJson.px200) document.getElementById('px200').value = aiJson.px200;
            
            toast('¡Perfil IA completado con éxito!', 'success');
        } catch (e) {
            console.error('Gemini error:', e);
            toast('Error al consultar la Inteligencia Artificial: ' + e.message, 'error');
        } finally {
            btn.innerHTML = '<i class="bi bi-magic"></i> IA';
            btn.disabled = false;
        }
    });

window.save = async function () {
  const btn = document.getElementById('btn-save');
  const nombre = document.getElementById('p-nombre').value.trim();
  const marca  = document.getElementById('p-marca').value.trim();
  const conc   = document.getElementById('p-concentracion').value;
  const genero = document.getElementById('p-genero').value;
  const disp   = document.getElementById('p-disponibilidad').value;

  if (!nombre || !marca || !conc || !genero || !disp) {
    alert('Nombre, marca, concentración, género y disponibilidad son obligatorios.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

  try {
    let imagen = document.getElementById('p-img-url').value.trim();
    if (imgMode === 'file') {
      const file = document.getElementById('p-img-file').files[0];
      if (file) imagen = await uploadCloudinary(file);
    }

    const precios = {};
    ['30','50','75','100','150','200'].forEach(t => {
      const v = parseFloat(document.getElementById(`px${t}`).value);
      if (v > 0) precios[`px${t}`] = v;
    });

    const data = {
      nombre, marca,
      concentracion: conc,
      genero,
      disponibilidad: disp,
      tiempoEstimado: disp === 'bajo-pedido' ? document.getElementById('p-tiempo').value.trim() : '',
      original: document.getElementById('p-original').checked,
      sellada: document.getElementById('p-sellada').checked,
      batch: document.getElementById('p-batch').value.trim(),
      notasSalida: document.getElementById('p-salida').value.trim(),
      notasCorazon: document.getElementById('p-corazon').value.trim(),
      notasFondo: document.getElementById('p-fondo').value.trim(),
      ocasion: document.getElementById('p-ocasion').value.trim(),
      longevidad: document.getElementById('p-longevidad').value,
      proyeccion: document.getElementById('p-proyeccion').value,
      descripcion: document.getElementById('p-desc').value.trim(),
      logistica: document.getElementById('p-logistica').value.trim(),
      pago: document.getElementById('p-pago').value.trim(),
      barcode: document.getElementById('p-barcode').value.trim(),
      imagen,
      precios,
      activo: document.getElementById('p-activo').checked,
      actualizadoEn: serverTimestamp()
    };

    const id = document.getElementById('p-id').value;
    if (id) {
      await updateDoc(doc(db, COL, id), data);
    } else {
      data.creadoEn = serverTimestamp();
      await addDoc(collection(db, COL), data);
    }

    closeModal();
    await load();
  } catch (e) {
    console.error(e);
    alert('Error al guardar: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2"></i> Guardar';
  }
};

// ── Eliminar ──────────────────────────────────────────────
window.remove = async function (id) {
  if (!confirm('¿Eliminar este perfume del catálogo?')) return;
  await deleteDoc(doc(db, COL, id));
  await load();
};

// ── Tab view Switcher & Archive helpers ──────────────────────────────────────
window.setCatalogTab = function (tab) {
  currentTab = tab;
  
  const btnActivos = document.getElementById('btn-tab-activos');
  const btnArchivados = document.getElementById('btn-tab-archivados');
  
  if (tab === 'activos') {
    if (btnActivos) { btnActivos.style.background = 'var(--accent)'; btnActivos.style.color = '#000'; btnActivos.style.opacity = '1'; }
    if (btnArchivados) { btnArchivados.style.background = 'transparent'; btnArchivados.style.color = 'var(--text-muted)'; btnArchivados.style.opacity = '0.7'; }
  } else {
    if (btnActivos) { btnActivos.style.background = 'transparent'; btnActivos.style.color = 'var(--text-muted)'; btnActivos.style.opacity = '0.7'; }
    if (btnArchivados) { btnArchivados.style.background = 'var(--accent)'; btnArchivados.style.color = '#000'; btnArchivados.style.opacity = '1'; }
  }
  
  renderTable();
};

window.toggleActivo = async function (id, activo) {
  try {
    await updateDoc(doc(db, COL, id), { activo, actualizadoEn: serverTimestamp() });
    const p = items.find(x => x.id === id);
    if (p) p.activo = activo;
    renderTable();
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  }
};

// ── Evento Autocompletado por Código de Barras ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const barcodeInput = document.getElementById('p-barcode');
  if (barcodeInput) {
    barcodeInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const codeRaw = barcodeInput.value.trim();
        const code = codeRaw.replace(/\D/g, '');
        if (!code) return;
        
        toast('Buscando información del código de barras en BD pública...', 'info');
        try {
          let res = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${code}.json`);
          let data = null;
          if (res.ok) {
              try { data = await res.json(); } catch(e) {}
          }
          
          let prodTitle = '';
          let prodBrand = '';
          let prodDesc = '';
          let prodImg = '';
          
          if (data && data.status === 1 && data.product) {
            const prod = data.product;
            prodTitle = prod.product_name || prod.product_name_es || prod.product_name_en || prod.product_name_fr || '';
            prodBrand = prod.brands || '';
            prodDesc = prod.categories || '';
            prodImg = prod.image_url || prod.image_front_url || '';
          }
          
          if (prodTitle) {
            if (!document.getElementById('p-nombre').value) document.getElementById('p-nombre').value = prodTitle;
            
            // Fuzzy match en el dropdown de Marca
            if (prodBrand) {
              const marcaSelect = document.getElementById('p-marca');
              if (marcaSelect && !marcaSelect.value) {
                const brandClean = prodBrand.split(',')[0].trim().toLowerCase();
                let bestMatch = '';
                for (let opt of marcaSelect.options) {
                  if (opt.value && opt.text.toLowerCase().includes(brandClean)) { bestMatch = opt.value; break; }
                }
                // Si no hay match exacto, busca al revés
                if (!bestMatch) {
                  for (let opt of marcaSelect.options) {
                    if (opt.value && brandClean.includes(opt.text.toLowerCase().split(' ')[0])) { bestMatch = opt.value; break; }
                  }
                }
                if (bestMatch) marcaSelect.value = bestMatch;
              }
            }
            
            if (prodDesc && !document.getElementById('p-desc').value) document.getElementById('p-desc').value = prodDesc;
            if (prodImg && !document.getElementById('p-img-url').value) {
                document.getElementById('p-img-url').value = prodImg;
                if (window.previewUrl) window.previewUrl();
            }
            
            // Integración Gemini IA
            const geminiKey = localStorage.getItem('gemini_api_key');
            if (geminiKey && prodTitle) {
                toast('Generando perfil olfativo con Inteligencia Artificial...', 'info');
                try {
                    const getOpts = id => {
                        const el = document.getElementById(id);
                        return el ? Array.from(el.options).map(o => o.value).filter(v => v).join(', ') : '';
                    };
                    
                    const pBrand = prodBrand ? prodBrand.split(',')[0] : '';
                    const promptText = `Eres un experto perfumista. Para el perfume "${prodTitle}"${pBrand ? ` de la marca "${pBrand}"` : ''}:
Genera su perfil olfativo y elige las mejores opciones de estas listas:
- Concentración: [${getOpts('p-concentracion')}]
- Género: [${getOpts('p-genero')}]
- Longevidad: [${getOpts('p-longevidad')}]
- Proyección: [${getOpts('p-proyeccion')}]

Sugiéreme precios de venta en MXN para presentaciones comerciales regulares completas (30ml, 50ml, 75ml, 100ml, 150ml, 200ml) basándote en su valor de retail en México.
Para la descripción ("desc"), redacta una reseña detallada, poética y persuasiva (de 3 a 4 oraciones). Habla de su apertura, desarrollo, fijación y ocasiones de uso, usando un tono de marketing elegante.

Responde ÚNICAMENTE con un objeto JSON en texto plano (sin markdown ni \`\`\`) con esta estructura exacta:
{"concentracion":"","genero":"","salida":"","corazon":"","fondo":"","ocasion":"","longevidad":"","proyeccion":"","desc":"Descripción detallada y poética","px30":0,"px50":0,"px75":0,"px100":0,"px150":0,"px200":0}`;
                    
                    const groqUrl = `https://api.openai.com/v1/chat/completions`;
                    const groqRes = await fetch(groqUrl, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${geminiKey}`
                        },
                        body: JSON.stringify({
                            model: "gpt-4o",
                            messages: [{ role: "user", content: promptText }],
                            temperature: 0.2
                        })
                    });
                    
                    const data = await groqRes.json();
                    
                    if (data.error) {
                        console.error("Error IA:", data.error.message);
                        return;
                    }
                    
                    let aiText = data.choices[0].message.content;
                    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) { aiText = jsonMatch[0]; }
                    
                    const aiJson = JSON.parse(aiText);
                        
                        if (aiJson.salida) document.getElementById('p-salida').value = aiJson.salida;
                        if (aiJson.corazon) document.getElementById('p-corazon').value = aiJson.corazon;
                        if (aiJson.fondo) document.getElementById('p-fondo').value = aiJson.fondo;
                        if (aiJson.ocasion) document.getElementById('p-ocasion').value = aiJson.ocasion;
                        if (aiJson.desc) document.getElementById('p-desc').value = aiJson.desc;
                        
                        if (aiJson.concentracion) document.getElementById('p-concentracion').value = aiJson.concentracion;
                        if (aiJson.genero) document.getElementById('p-genero').value = aiJson.genero;
                        if (aiJson.longevidad) document.getElementById('p-longevidad').value = aiJson.longevidad;
                        if (aiJson.proyeccion) document.getElementById('p-proyeccion').value = aiJson.proyeccion;
                        
                        if (aiJson.px30 && !document.getElementById('px30').value) document.getElementById('px30').value = aiJson.px30;
                        if (aiJson.px50 && !document.getElementById('px50').value) document.getElementById('px50').value = aiJson.px50;
                        if (aiJson.px75 && !document.getElementById('px75').value) document.getElementById('px75').value = aiJson.px75;
                        if (aiJson.px100 && !document.getElementById('px100').value) document.getElementById('px100').value = aiJson.px100;
                        if (aiJson.px150 && !document.getElementById('px150').value) document.getElementById('px150').value = aiJson.px150;
                        if (aiJson.px200 && !document.getElementById('px200').value) document.getElementById('px200').value = aiJson.px200;
                        
                        toast('¡Perfil IA completado con éxito!', 'success');
                } catch (e) {
                    console.error('Gemini error:', e);
                    toast('¡Datos básicos completados! (Ocurrió un error con la IA: ' + e.message + ')', 'warning');
                }
            } else {
                toast('¡Información encontrada en BD y autocompletada!', 'success');
            }
          } else {
            const geminiKey = localStorage.getItem('gemini_api_key');
            if (!geminiKey) {
                toast('El código no se encontró en la BD pública (Configura tu API Key en Ajustes para usar IA).', 'warning');
                return;
            }
            toast('No encontrado en BD pública. Consultando a la Inteligencia Artificial...', 'info');
            
            try {
                const getOpts = id => {
                    const el = document.getElementById(id);
                    return el ? Array.from(el.options).map(o => o.value).filter(v => v).join(', ') : '';
                };
                const promptText = `El usuario escaneó el código de barras "${code}" de un perfume.
Identifica el nombre exacto del perfume y su marca. Si el código no te suena para nada a un perfume conocido, responde el JSON con "title": "NO_ENCONTRADO".
Si lo reconoces, elige la mejor opción de estas listas exactas para clasificarlo:
- Marca: [${getOpts('p-marca')}]
- Ocasión de uso: [${getOpts('p-ocasion')}]
- Longevidad: [${getOpts('p-longevidad')}]
- Proyección: [${getOpts('p-proyeccion')}]

Sugiéreme precios de venta en MXN competitivos para presentaciones completas (30ml, 50ml, 75ml, 100ml, 150ml, 200ml) basándote en su valor de retail en México (ej. 100ml de diseñador ~2500, nicho ~5000). Pon 0 en los tamaños que no apliquen.
Para la descripción ("desc"), redacta una reseña detallada, poética y persuasiva (de 3 a 4 oraciones). Habla de su apertura, desarrollo, fijación y ocasiones de uso, usando un tono de marketing elegante.

Responde ÚNICAMENTE con un objeto JSON en texto plano (sin markdown) con esta estructura exacta:
{"title":"Nombre del perfume","marca":"","concentracion":"","genero":"","salida":"","corazon":"","fondo":"","ocasion":"","longevidad":"","proyeccion":"","desc":"Descripción detallada y poética","px30":0,"px50":0,"px75":0,"px100":0,"px150":0,"px200":0}`;

                const groqUrl = `https://api.openai.com/v1/chat/completions`;
                const groqRes = await fetch(groqUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${geminiKey}` },
                    body: JSON.stringify({ 
                        model: "gpt-4o", 
                        messages: [{ role: "user", content: promptText }], 
                        temperature: 0.2,
                        response_format: { type: "json_object" }
                    })
                });
                
                const data = await groqRes.json();
                if (data.choices && data.choices.length > 0) {
                    let aiText = data.choices[0].message.content;
                    const match = aiText.match(/\{[\s\S]*\}/);
                    if (match) aiText = match[0];
                    
                    let aiJson;
                    try {
                        aiJson = JSON.parse(aiText);
                    } catch (err) {
                        aiText = aiText.replace(/[\u0000-\u001F]+/g, " ");
                        aiJson = JSON.parse(aiText);
                    }
                    
                    if (aiJson.title === "NO_ENCONTRADO") {
                        toast('Barcode no reconocido. Escribe el nombre a mano y usa el botón de IA.', 'warning');
                        return;
                    }
                    
                    document.getElementById('p-nombre').value = aiJson.title || '';
                    
                    if (aiJson.marca) {
                        const brandClean = aiJson.marca.trim().toLowerCase();
                        const marcaSelect = document.getElementById('p-marca');
                        let bestMatch = '';
                        for (let opt of marcaSelect.options) {
                            if (opt.value && opt.text.toLowerCase().includes(brandClean)) { bestMatch = opt.value; break; }
                        }
                        if (bestMatch) marcaSelect.value = bestMatch;
                        else document.getElementById('p-marca').value = aiJson.marca;
                    }
                    
                    if (aiJson.salida) document.getElementById('p-salida').value = aiJson.salida;
                    if (aiJson.corazon) document.getElementById('p-corazon').value = aiJson.corazon;
                    if (aiJson.fondo) document.getElementById('p-fondo').value = aiJson.fondo;
                    if (aiJson.ocasion) document.getElementById('p-ocasion').value = aiJson.ocasion;
                    if (aiJson.desc) document.getElementById('p-desc').value = aiJson.desc;
                    
                    if (aiJson.concentracion) document.getElementById('p-concentracion').value = aiJson.concentracion;
                    if (aiJson.genero) document.getElementById('p-genero').value = aiJson.genero;
                    if (aiJson.longevidad) document.getElementById('p-longevidad').value = aiJson.longevidad;
                    if (aiJson.proyeccion) document.getElementById('p-proyeccion').value = aiJson.proyeccion;
                    
                    if (aiJson.px30) document.getElementById('px30').value = aiJson.px30;
                    if (aiJson.px50) document.getElementById('px50').value = aiJson.px50;
                    if (aiJson.px75) document.getElementById('px75').value = aiJson.px75;
                    if (aiJson.px100) document.getElementById('px100').value = aiJson.px100;
                    if (aiJson.px150) document.getElementById('px150').value = aiJson.px150;
                    if (aiJson.px200) document.getElementById('px200').value = aiJson.px200;
                    
                    toast('¡Perfume identificado mágicamente por la IA!', 'success');
                }
            } catch (e) {
                console.error('Groq fallback error:', e);
                toast('Error al intentar identificar con IA: ' + e.message, 'error');
            }
          }
        } catch (err) {
          console.error(err);
          toast('Hubo un error de conexión al buscar el código.', 'error');
        }
      }
    });
  }
});

load();
