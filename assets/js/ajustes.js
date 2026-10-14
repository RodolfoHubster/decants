import { onAuthStateChanged, db, doc, getDoc, setDoc, updateDoc } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { auth } from './firebase-config.js';
import { temporadaVigente } from './temporada.js';

renderSidebar('ajustes');

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  const keyInput = document.getElementById('gemini-key');
  const btnDelete = document.getElementById('btn-delete');
  
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) {
    keyInput.value = savedKey;
    btnDelete.style.display = 'inline-flex';
    document.getElementById('btn-test').style.display = 'inline-flex';
  }
});

window.toggleView = () => {
  const input = document.getElementById('gemini-key');
  const icon = document.querySelector('#btn-toggle-view i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('bi-eye');
    icon.classList.add('bi-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('bi-eye-slash');
    icon.classList.add('bi-eye');
  }
};

window.saveKey = () => {
  const input = document.getElementById('gemini-key').value.trim();
  if (!input) {
    toast('Por favor ingresa tu API Key', 'warning');
    return;
  }
  localStorage.setItem('gemini_api_key', input);
  document.getElementById('btn-delete').style.display = 'inline-flex';
  document.getElementById('btn-test').style.display = 'inline-flex';
  toast('API Key guardada de forma segura', 'success');
};

window.deleteKey = () => {
  if (confirm('¿Estás seguro de eliminar tu API Key guardada?')) {
    localStorage.removeItem('gemini_api_key');
    document.getElementById('gemini-key').value = '';
    document.getElementById('btn-delete').style.display = 'none';
    document.getElementById('btn-test').style.display = 'none';
    toast('API Key eliminada', 'info');
  }
};

window.testKey = async () => {
  const key = document.getElementById('gemini-key').value.trim();
  if (!key) { toast('Ingresa una llave primero', 'warning'); return; }
  
  const btn = document.getElementById('btn-test');
  const ogHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Probando...';
  
  try {
    const url = `https://api.openai.com/v1/chat/completions`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Di 'Hola'" }]
        })
    });
    const data = await res.json();
    
    if (data.error) {
      alert('Error de API:\\n' + data.error.message);
    } else if (data.choices && data.choices.length > 0) {
      alert('¡Conexión exitosa! La Inteligencia Artificial respondió:\\n"' + data.choices[0].message.content + '"');
    } else {
      alert('Respuesta desconocida de la API:\\n' + JSON.stringify(data));
    }
  } catch (err) {
    alert('Fallo al conectar con la API de Groq:\\n' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = ogHtml;
  }
};

// ── Temporada especial (config/tienda → temporada) ──────────────────────────
const TEMP_ID = 'halloween';
const TIENDA = () => doc(db, 'config', 'tienda');

function pintarEstadoTemporada(t) {
  const el = document.getElementById('temp-estado');
  if (!el) return;
  const vigente = temporadaVigente({ temporada: t });
  el.classList.toggle('on', !!vigente);
  if (!t || !t.activa) el.textContent = 'Apagada: la tienda se ve como siempre.';
  else if (vigente) el.textContent = 'Se está viendo en la tienda ahora mismo.';
  else el.textContent = 'Encendida, pero hoy está fuera de las fechas: no se ve.';
}

async function cargarTemporada() {
  try {
    const snap = await getDoc(TIENDA());
    const t = snap.exists() ? snap.data().temporada : null;
    document.getElementById('temp-activa').checked = !!(t && t.activa);
    document.getElementById('temp-inicio').value = (t && t.inicio) || '2026-10-16';
    document.getElementById('temp-fin').value = (t && t.fin) || '2026-11-03';
    pintarEstadoTemporada(t);
  } catch (e) {
    console.error('No se pudo leer la temporada', e);
  }
}

window.guardarTemporada = async () => {
  const activa = document.getElementById('temp-activa').checked;
  const inicio = document.getElementById('temp-inicio').value;
  const fin = document.getElementById('temp-fin').value;
  if (!inicio || !fin) return toast('Pon la fecha de inicio y la de fin', 'error');
  if (inicio >= fin) return toast('La fecha de fin debe ser después del inicio', 'error');
  const btn = document.getElementById('btn-temp');
  btn.disabled = true;
  try {
    // Por campo (dot-notation): no se pisa disable2ml ni lo demás de config/tienda.
    const cambios = { 'temporada.id': TEMP_ID, 'temporada.activa': activa, 'temporada.inicio': inicio, 'temporada.fin': fin };
    const snap = await getDoc(TIENDA());
    if (snap.exists()) await updateDoc(TIENDA(), cambios);
    else await setDoc(TIENDA(), { temporada: { id: TEMP_ID, activa, inicio, fin } }, { merge: true });
    pintarEstadoTemporada({ id: TEMP_ID, activa, inicio, fin });
    toast('Temporada guardada. Los visitantes la ven en su siguiente visita.', 'success');
  } catch (e) {
    console.error(e);
    toast('No se pudo guardar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
};

onAuthStateChanged(auth, user => { if (user) cargarTemporada(); });
