import { onAuthStateChanged } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { auth } from './firebase-config.js';

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
