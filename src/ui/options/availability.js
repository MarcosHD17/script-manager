// Aviso cuando falta el permiso "Permitir scripts de usuario".
import { els } from './dom.js';

export async function checkAvailability() {
  try {
    await chrome.userScripts.getScripts();
  } catch {
    els.warning.hidden = false;
    els.warning.className = 'alert';
    els.warning.textContent = '⚠ Falta un permiso: activa "Permitir scripts de usuario" en los detalles de esta extensión.';
  }
}
