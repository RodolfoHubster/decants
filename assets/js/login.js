import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from './firebase-config.js';

// Si ya está logueado, redirigir al dashboard
onAuthStateChanged(auth, user => {
  if (user) window.location.replace('./admin/dashboard.html');
});

const btnLogin = document.getElementById('btn-login');
const errMsg   = document.getElementById('err-msg');

btnLogin.addEventListener('click', async () => {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  errMsg.textContent = '';
  if (!email || !password) { errMsg.textContent = 'Completa todos los campos.'; return; }
  btnLogin.disabled = true;
  btnLogin.innerHTML = '<i class="bi bi-hourglass-split"></i> Ingresando...';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.replace('./admin/dashboard.html');
  } catch (e) {
    errMsg.textContent = 'Correo o contraseña incorrectos.';
    btnLogin.disabled = false;
    btnLogin.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Ingresar';
  }
});

document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') btnLogin.click();
});

window.togglePass = () => {
  const inp  = document.getElementById('password');
  const icon = document.getElementById('eye-icon');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'bi bi-eye-slash';
  } else {
    inp.type = 'password';
    icon.className = 'bi bi-eye';
  }
};
