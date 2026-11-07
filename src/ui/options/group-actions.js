// Operaciones sobre grupos: crear, renombrar, eliminar (con diálogo), mover la selección y plegar todo.
import { getScripts, setScripts, getGroups, setGroups, getHistory, setHistory, getSettings, setSettings } from '../../data/storage.js';
import { moveMany, nextGroupColor, setAllCollapsed } from '../../core/organize/index.js';
import { $ } from '../shared/dom.js';
import { els, showMessage } from './dom.js';
import { state, hooks, selected, selectedGroups } from './state.js';
import { refreshGroupOptions } from './editor-form.js';

export async function createGroup(name) {
  const groups = await getGroups();
  const group = { id: crypto.randomUUID(), name, collapsed: false, color: nextGroupColor(groups) };
  await setGroups([...groups, group]);
  await refreshGroupOptions();
  return group;
}

export async function moveSelectionTo(groupId, label) {
  const ids = [...selected];
  if (!ids.length) return;
  await setScripts(moveMany(await getScripts(), ids, { groupId }));
  if (state.selectedId && ids.includes(state.selectedId)) await refreshGroupOptions().then(() => { els.group.value = groupId ?? ''; });
  showMessage(`${ids.length} script(s) movido(s) a ${label}.`);
}

export async function newGroupFromSelection() {
  const name = prompt('Nombre del nuevo grupo:')?.trim();
  if (!name) return;
  const group = await createGroup(name);
  if (selected.size) await moveSelectionTo(group.id, `"${group.name}"`);
  else showMessage(`Grupo "${name}" creado. Arrastra scripts hasta él o elígelo en el editor.`);
}

export async function renameGroup(group) {
  const name = prompt('Nombre del grupo:', group.name)?.trim();
  if (!name) return;
  await setGroups((await getGroups()).map((g) => (g.id === group.id ? { ...g, name } : g)));
  await refreshGroupOptions();
}

// Pregunta qué hacer con los scripts de los grupos a eliminar: 'group' (solo el grupo), 'all' (grupo y scripts) o null.
function askDeleteMode(text) {
  return new Promise((resolve) => {
    $('deleteText').textContent = text;
    let answer = null;
    const finish = (value) => { answer = value; els.dialog.close(); };
    const bind = (id, value) => { $(id).onclick = () => finish(value); };
    bind('delOnlyGroup', 'group');
    bind('delWithScripts', 'all');
    bind('delCancel', null);
    els.dialog.onclose = () => resolve(answer);
    els.dialog.showModal();
  });
}

export async function deleteGroups(ids) {
  const [groups, scripts] = await Promise.all([getGroups(), getScripts()]);
  const doomed = groups.filter((g) => ids.includes(g.id));
  if (!doomed.length) return;
  const affected = scripts.filter((s) => ids.includes(s.group));
  const label = doomed.length === 1 ? `el grupo "${doomed[0].name}"` : `${doomed.length} grupos`;
  const mode = await askDeleteMode(`¿Eliminar ${label}? Contiene ${affected.length} script(s).`);
  if (!mode) return;
  if (mode === 'all' && affected.length) {
    const history = await getHistory();
    affected.forEach((s) => delete history[s.id]);
    await setHistory(history);
    if (affected.some((s) => s.id === state.selectedId)) hooks.clearEditor();
    await setScripts(scripts.filter((s) => !ids.includes(s.group)));
  } else {
    await setScripts(scripts.map((s) => (ids.includes(s.group) ? { ...s, group: null } : s)));
  }
  ids.forEach((id) => selectedGroups.delete(id));
  await setGroups(groups.filter((g) => !ids.includes(g.id)));
  await refreshGroupOptions();
  showMessage(mode === 'all' ? `${label} eliminado(s) con ${affected.length} script(s).` : `${label} eliminado(s); ${affected.length} script(s) pasan a "Sin grupo".`);
}

export async function patchSelectedGroups(patch) {
  await setGroups((await getGroups()).map((g) => (selectedGroups.has(g.id) ? { ...g, ...patch } : g)));
}

// Contrae o despliega todos los grupos y "Sin grupo" (si alguno está abierto, contrae; si no, despliega).
export async function toggleAllGroups() {
  const [groups, settings] = await Promise.all([getGroups(), getSettings()]);
  const collapse = groups.some((g) => !g.collapsed) || !settings.ungroupedCollapsed;
  await setGroups(setAllCollapsed(groups, collapse));
  await setSettings({ ...settings, ungroupedCollapsed: collapse });
}
