import { auth, signInWithEmailAndPassword, onAuthStateChanged } from './firebase-config.js';

onAuthStateChanged(auth, u => {
  if (u) window.location.href = './admin/dashboard.html';
});

document.getElementById('btn-login').onclick = async () => {
  const e = document.getElementById('email').value.trim();
  const p = document.getElementById('password').value;
  const err = document.getElementById('err-msg');
  const btn = document.getElementById('btn-login');
  err.style.display = 'none';
  if (!e || !p) { err.textContent = 'Completa todos los campos.'; err.style.display = 'block'; return; }
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Verificando...';
  try {
    await signInWithEmailAndPassword(auth, e, p);
  } catch (ex) {
    err.textContent = 'Correo o contraseña incorrectos.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Ingresar';
  }
};

window.togglePass = () => {
  const i = document.getElementById('password');
  const ic = document.getElementById('eye-icon');
  i.type = i.type === 'password' ? 'text' : 'password';
  ic.className = i.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
};

document.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-login').click(); });