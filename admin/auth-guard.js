import { auth, onAuthStateChanged } from '../assets/js/firebase-config.js';
onAuthStateChanged(auth, user => {
  if (!user) window.location.href = '../login.html';
});
