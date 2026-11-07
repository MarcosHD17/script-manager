// Lectura y escritura de los campos del formulario del editor.
import { getGroups } from '../../data/storage.js';
import { h } from '../shared/dom.js';
import { els } from './dom.js';

export function readEditor() {
  const matches = els.matches.value.split('\n').map((m) => m.trim()).filter(Boolean);
  return {
    name: els.name.value.trim() || 'Sin nombre',
    matches: matches.length ? matches : ['<all_urls>'],
    code: els.code.value,
    enabled: els.enabled.checked,
    grants: els.grants.value.split(',').map((g) => g.trim()).filter((g) => g && g !== 'none'),
    group: els.group.value || null
  };
}

export async function refreshGroupOptions() {
  const groups = await getGroups();
  const previous = els.group.value;
  els.group.replaceChildren(h('option', { value: '', textContent: '(sin grupo)' }),
    ...groups.map((g) => h('option', { value: g.id, textContent: g.name })));
  els.group.value = groups.some((g) => g.id === previous) ? previous : '';
}

export function applyHeader(meta) {
  if (meta.name) els.name.value = meta.name;
  if (meta.matches.length) els.matches.value = meta.matches.join('\n');
  els.grants.value = meta.grants.join(', ');
  const notes = [`Patrones: ${meta.matches.join(', ') || 'ninguno válido'}`];
  if (meta.repaired.length) notes.push(`corregidos: ${meta.repaired.join('; ')}`);
  if (meta.invalid.length) notes.push(`omitidos por inválidos: ${meta.invalid.join(', ')}`);
  if (meta.grants.length) notes.push(`permisos: ${meta.grants.join(', ')}`);
  return notes.join('. ');
}
