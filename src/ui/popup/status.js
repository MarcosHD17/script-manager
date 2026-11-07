// Estado de la extensión (permiso userScripts) y de la pestaña activa.
import { warning } from './dom.js';
import { ctx } from './state.js';

export async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// Muestra una alerta visible con acceso directo a los ajustes si falta el permiso.
export async function checkStatus() {
  const status = await chrome.runtime.sendMessage({ type: 'status' });
  ctx.available = !!status?.available;
  warning.hidden = ctx.available;
  document.getElementById('runAll').disabled = !ctx.available;
  if (ctx.available) return;
  warning.className = 'alert';
  warning.replaceChildren();
  const text = document.createElement('div');
  text.textContent = '⚠ Falta un permiso: activa "Permitir scripts de usuario" en los detalles de esta extensión (requiere Chrome 135+) y recarga la pestaña.';
  const open = document.createElement('button');
  open.textContent = 'Abrir ajustes de la extensión';
  open.addEventListener('click', () => chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }));
  warning.append(text, open);
}

export function formatStatus(entry) {
  const time = new Date(entry.time).toLocaleTimeString();
  return entry.ok ? `✔ ${time} (${entry.trigger})` : `✖ ${time}: ${entry.error}`;
}
