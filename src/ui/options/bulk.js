// Barras de selección (scripts y grupos) y acciones en masa.
import { getScripts, setScripts, getGroups, getHistory, setHistory } from '../../data/storage.js';
import { setEnabled } from '../../core/organize/index.js';
import { $, h } from '../shared/dom.js';
import { els, showMessage } from './dom.js';
import { state, hooks, selected, selectedGroups } from './state.js';
import { moveSelectionTo, newGroupFromSelection, patchSelectedGroups, deleteGroups, toggleAllGroups } from './group-actions.js';

export function updateBulkBar(groups) {
  const count = selected.size;
  els.bulkBar.hidden = count === 0;
  els.groupBar.hidden = selectedGroups.size === 0;
  els.groupBarCount.textContent = `${selectedGroups.size} grupo${selectedGroups.size === 1 ? '' : 's'}`;
  els.bulkCount.textContent = `${count} seleccionado${count === 1 ? '' : 's'}`;
  els.bulkGroup.replaceChildren(
    h('option', { value: '', textContent: 'Mover a grupo…' }),
    h('option', { value: '__none', textContent: '(sin grupo)' }),
    ...groups.map((g) => h('option', { value: g.id, textContent: `📁 ${g.name}` })),
    h('option', { value: '__new', textContent: '➕ Nuevo grupo con la selección…' })
  );
  const inView = state.visibleIds.filter((id) => selected.has(id)).length;
  els.selectAll.checked = state.visibleIds.length > 0 && inView === state.visibleIds.length;
  els.selectAll.indeterminate = inView > 0 && inView < state.visibleIds.length;
  els.selCount.textContent = state.visibleIds.length ? `${state.visibleIds.length} visibles` : '';
}

export function registerBulkActions() {
  els.search.addEventListener('input', () => hooks.renderList());
  $('gbPin').addEventListener('click', () => patchSelectedGroups({ pinned: true }));
  $('gbUnpin').addEventListener('click', () => patchSelectedGroups({ pinned: false }));
  $('gbCollapse').addEventListener('click', () => patchSelectedGroups({ collapsed: true }));
  $('gbExpand').addEventListener('click', () => patchSelectedGroups({ collapsed: false }));
  $('gbClear').addEventListener('click', () => { selectedGroups.clear(); hooks.renderList(); });
  $('gbDelete').addEventListener('click', () => deleteGroups([...selectedGroups]));
  els.toggleAll.addEventListener('click', toggleAllGroups);
  $('newGroup').addEventListener('click', newGroupFromSelection);
  $('newScript').addEventListener('click', () => { hooks.clearEditor(); hooks.renderList(); });
  els.selectAll.addEventListener('change', () => {
    state.visibleIds.forEach((id) => (els.selectAll.checked ? selected.add(id) : selected.delete(id)));
    hooks.renderList();
  });
  els.bulkGroup.addEventListener('change', async () => {
    const value = els.bulkGroup.value;
    els.bulkGroup.value = '';
    if (!value) return;
    if (value === '__new') return newGroupFromSelection();
    const groupId = value === '__none' ? null : value;
    const group = (await getGroups()).find((g) => g.id === groupId);
    await moveSelectionTo(groupId, group ? `"${group.name}"` : 'sin grupo');
  });
  els.bulkOn.addEventListener('click', async () => setScripts(setEnabled(await getScripts(), [...selected], true)));
  els.bulkOff.addEventListener('click', async () => setScripts(setEnabled(await getScripts(), [...selected], false)));
  els.bulkClear.addEventListener('click', () => { selected.clear(); hooks.renderList(); });
  els.bulkDelete.addEventListener('click', async () => {
    const ids = [...selected];
    if (!ids.length || !confirm(`¿Eliminar ${ids.length} script(s)? También se borra su historial de versiones.`)) return;
    const history = await getHistory();
    ids.forEach((id) => delete history[id]);
    await setHistory(history);
    await setScripts((await getScripts()).filter((s) => !selected.has(s.id)));
    if (ids.includes(state.selectedId)) hooks.clearEditor();
    selected.clear();
    hooks.renderList();
    showMessage(`${ids.length} script(s) eliminado(s).`);
  });
}
