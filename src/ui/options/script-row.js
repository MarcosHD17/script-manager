// Fila de script en la lista.
import { getScripts, setScripts, getGroups, getSettings, setSettings } from '../../data/storage.js';
import { setEnabled, bakeOrder, moveToTop, rangeIds } from '../../core/organize/index.js';
import { h } from '../shared/dom.js';
import { showMessage } from './dom.js';
import { state, hooks, selected } from './state.js';
import { switchControl } from './controls.js';
import { beginDrag } from './drag.js';

async function sendToTop(id) {
  const [scripts, groups, settings] = await Promise.all([getScripts(), getGroups(), getSettings()]);
  let base = scripts;
  if (settings.sort !== 'manual') {
    base = bakeOrder(scripts, groups, settings.sort);
    await setSettings({ ...settings, sort: 'manual' });
    showMessage('Orden cambiado a Manual para respetar la posición.');
  }
  await setScripts(moveToTop(base, id));
}

function rangeSelect(toId) {
  rangeIds(state.visibleIds, state.lastClickedId, toId).forEach((id) => selected.add(id));
  hooks.renderList();
}

export function scriptRow(script, statuses) {
  const failed = statuses[script.id]?.ok === false;
  const pick = h('input', { type: 'checkbox', class: 'sel', checked: selected.has(script.id), title: 'Seleccionar (Mayús: rango)' });
  pick.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.shiftKey && state.lastClickedId) { e.preventDefault(); rangeSelect(script.id); return; }
    if (pick.checked) selected.add(script.id); else selected.delete(script.id);
    state.lastClickedId = script.id;
    hooks.renderList();
  });
  const row = h('div', { class: 'item' + (script.id === state.selectedId ? ' active' : '') + (selected.has(script.id) ? ' selected' : '') },
    h('span', { class: 'grip', textContent: '⠿', title: 'Arrastra para ordenar o mover de grupo' }), pick,
    h('span', { class: 'label', textContent: script.name + (failed ? ' ⚠' : '') }));
  row.dataset.id = script.id;
  row.dataset.group = script.group ?? '';
  if (script.rev) row.append(h('span', { class: 'badge', textContent: `v${script.rev}`, title: 'Versión' }));
  if (script.grants?.length) row.append(h('span', { class: 'badge', textContent: 'GM', title: script.grants.join(', ') }));
  const top = h('button', { class: 'mini', textContent: '⤒', title: 'Llevar al principio de su grupo' });
  top.addEventListener('click', async (e) => { e.stopPropagation(); await sendToTop(script.id); });
  row.append(top);
  row.append(switchControl(script.enabled, 'Activo', async (value) => {
    await setScripts(setEnabled(await getScripts(), [script.id], value));
  }).node);

  row.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (selected.has(script.id)) selected.delete(script.id); else selected.add(script.id);
      state.lastClickedId = script.id;
      return hooks.renderList();
    }
    if (e.shiftKey && state.lastClickedId) return rangeSelect(script.id);
    state.lastClickedId = script.id;
    hooks.select(script.id);
  });
  row.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('input, button, .switch')) return;
    if (e.pointerType === 'touch' && !e.target.closest('.grip')) return; // en táctil solo desde el asa
    beginDrag({ id: script.id, name: script.name, startX: e.clientX, startY: e.clientY });
  });
  return row;
}
