// Referencias a elementos de popup.html y mensajes de estado.
import { $ } from '../shared/dom.js';

export const list = $('list');
export const warning = $('warning');
export const toggleAll = $('toggleAll');
export const msg = $('msg');

export function notify(text, kind = 'ok') {
  msg.hidden = false;
  msg.className = kind === 'ok' ? 'ok' : 'alert';
  msg.textContent = text;
}
