// Cabecera de cada sección de grupo (o "Sin grupo").
import { getScripts, setScripts, getGroups, setGroups, getSettings, setSettings } from '../../data/storage.js';
import { enabledState, setEnabled, togglePinned, moveGroupToTop } from '../../core/organize/index.js';
import { h } from '../shared/dom.js';
import { hooks, selected, selectedGroups } from './state.js';
import { switchControl } from './controls.js';
import { beginDrag } from './drag.js';
import { renameGroup, deleteGroups } from './group-actions.js';

export function groupHeader(section, groups, collapsed) {
  const { group, scripts: shown } = section;
  const ids = shown.map((s) => s.id);
  const selectedCount = ids.filter((id) => selected.has(id)).length;
  const pick = group
    ? h('input', { type: 'checkbox', checked: selectedGroups.has(group.id), title: 'Seleccionar el grupo y sus scripts (Ctrl+clic en la cabecera también)' })
    : h('input', { type: 'checkbox', checked: ids.length > 0 && selectedCount === ids.length, title: 'Seleccionar los scripts de esta sección' });
  if (!group) pick.indeterminate = selectedCount > 0 && selectedCount < ids.length;
  pick.addEventListener('change', () => {
    if (group) (pick.checked ? selectedGroups.add(group.id) : selectedGroups.delete(group.id));
    ids.forEach((id) => (pick.checked ? selected.add(id) : selected.delete(id)));
    hooks.renderList();
  });
  const master = switchControl(enabledState(shown) === 'all', 'Activar o desactivar todos los de esta sección', async (value) => {
    await setScripts(setEnabled(await getScripts(), ids, value));
  });
  master.input.indeterminate = enabledState(shown) === 'some';

  const toggle = async () => {
    if (!group) {
      const settings = await getSettings();
      return setSettings({ ...settings, ungroupedCollapsed: !settings.ungroupedCollapsed });
    }
    await setGroups((await getGroups()).map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)));
  };
  const row = h('div', { class: 'group-row' + (group && selectedGroups.has(group.id) ? ' selected' : '') }, pick);
  row.dataset.groupId = group?.id ?? '';
  if (group) {
    row.prepend(h('span', { class: 'grip ggrip', textContent: '⠿', title: 'Arrastra el grupo (o cualquier parte de la cabecera) para moverlo' }));
    const color = h('input', { type: 'color', class: 'gcolor', value: group.color, title: 'Color del grupo' });
    color.addEventListener('click', (e) => e.stopPropagation());
    color.addEventListener('change', async () => {
      await setGroups((await getGroups()).map((g) => (g.id === group.id ? { ...g, color: color.value } : g)));
    });
    row.append(color);
    row.addEventListener('click', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.target.closest('input, button, .switch')) return;
      if (selectedGroups.has(group.id)) selectedGroups.delete(group.id); else selectedGroups.add(group.id);
      hooks.renderList();
    });
    row.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('input, button, .switch')) return;
      if (e.pointerType === 'touch' && !e.target.closest('.grip')) return;
      beginDrag({ kind: 'group', id: group.id, name: group.name, startX: e.clientX, startY: e.clientY });
    });
  }
  row.append(h('button', { class: 'mini', textContent: collapsed ? '▸' : '▾', title: 'Plegar o desplegar', onclick: toggle }));
  row.append(h('span', { class: 'gname', textContent: group ? `📁 ${group.name}` : 'Sin grupo', onclick: toggle }),
    h('span', { class: 'count', textContent: String(shown.length) }));
  if (group) {
    row.append(
      h('button', { class: 'mini pin' + (group.pinned ? ' on' : ''), textContent: '📌', title: group.pinned ? 'Quitar fijado' : 'Fijar el grupo arriba', onclick: async () => setGroups(togglePinned(await getGroups(), group.id)) }),
      h('button', { class: 'mini', textContent: '⤒', title: 'Llevar el grupo al principio', onclick: async () => setGroups(moveGroupToTop(await getGroups(), group.id)) }),
      h('button', { class: 'mini', textContent: '✎', title: 'Renombrar', onclick: () => renameGroup(group) }),
      h('button', { class: 'mini', textContent: '🗑', title: 'Eliminar grupo', onclick: () => deleteGroups([group.id]) })
    );
  }
  row.append(master.node);
  return row;
}
