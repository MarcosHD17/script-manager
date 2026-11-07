// Controles reutilizables de la lista.
import { h } from '../shared/dom.js';

export function switchControl(checked, title, onChange) {
  const input = h('input', { type: 'checkbox', checked, title });
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('change', () => onChange(input.checked));
  return { input, node: h('label', { class: 'switch', title, onclick: (e) => e.stopPropagation() }, input, h('span', { class: 'slider' })) };
}
