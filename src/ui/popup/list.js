// Render de la lista del popup: cabeceras de grupo y filas de scripts.
import { getScripts, setScripts, getRunStatus, getGroups, setGroups, getSettings, setSettings } from '../../data/storage.js';
import { buildSections, setEnabled, enabledState, ensureGroupColors, togglePinned, moveGroupToTop } from '../../core/organize/index.js';
import { matchesUrl } from '../../core/match.js';
import { list, toggleAll } from './dom.js';
import { ctx } from './state.js';
import { toggleButton } from './controls.js';
import { formatStatus, getActiveTabId } from './status.js';
import { sendToTop, openOptions } from './actions.js';
import { beginDrag } from './drag.js';

function groupHeader(section, collapsed) {
  const group = section.group;
  const state = enabledState(section.scripts);
  const master = toggleButton(state, 'Activar o desactivar todos', async () => {
    await setScripts(setEnabled(await getScripts(), section.scripts.map((s) => s.id), state !== 'all'));
  });

  const toggle = document.createElement('button');
  toggle.className = 'mini';
  toggle.textContent = collapsed ? '▸' : '▾';
  toggle.title = 'Plegar o desplegar';
  toggle.addEventListener('click', async () => {
    if (!group) {
      const settings = await getSettings();
      return setSettings({ ...settings, ungroupedCollapsed: !settings.ungroupedCollapsed });
    }
    await setGroups((await getGroups()).map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)));
  });

  const name = document.createElement('span');
  name.textContent = group ? `📁 ${group.name}` : 'Sin grupo';
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = String(section.scripts.length);

  const li = document.createElement('li');
  li.className = 'group-head';
  li.dataset.groupId = group?.id ?? '';
  if (group) li.style.setProperty('--gcolor', group.color);
  li.append(master, toggle, name, count);
  if (group) {
    const grip = document.createElement('span');
    grip.className = 'grip ggrip';
    grip.textContent = '⠿';
    grip.title = 'Arrastra para mover el grupo';
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      beginDrag({ kind: 'group', id: group.id, name: group.name, startX: e.clientX, startY: e.clientY });
    });
    const pin = document.createElement('button');
    pin.className = 'mini pin' + (group.pinned ? ' on' : '');
    pin.textContent = '📌';
    pin.title = group.pinned ? 'Quitar fijado' : 'Fijar el grupo arriba';
    pin.addEventListener('click', async () => setGroups(togglePinned(await getGroups(), group.id)));
    const top = document.createElement('button');
    top.className = 'mini';
    top.textContent = '⤒';
    top.title = 'Llevar el grupo al principio';
    top.addEventListener('click', async () => setGroups(moveGroupToTop(await getGroups(), group.id)));
    li.prepend(grip);
    li.append(pin, top);
  }
  return li;
}

function scriptItem(script, statuses, color) {
  const li = document.createElement('li');
  li.dataset.id = script.id;
  li.dataset.group = script.group ?? '';
  if (color) {
    li.classList.add('in-group');
    li.style.setProperty('--gcolor', color);
  }

  const checkbox = toggleButton(script.enabled ? 'all' : 'none', 'Activar o desactivar la carga automática', async () => {
    await setScripts(setEnabled(await getScripts(), [script.id], !script.enabled));
  });

  const info = document.createElement('div');
  info.className = 'info';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = script.name;
  const matches = document.createElement('div');
  matches.className = 'matches';
  matches.textContent = script.matches.join(', ');
  info.append(name, matches);
  const entry = statuses[script.id];
  if (entry) {
    const state = document.createElement('div');
    state.className = entry.ok ? 'matches' : 'err';
    state.textContent = formatStatus(entry);
    info.append(state);
  }

  const run = document.createElement('button');
  run.textContent = '▶';
  run.title = 'Ejecutar ahora en la pestaña actual';
  run.disabled = !ctx.available;
  run.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'run', tabId: await getActiveTabId(), scriptId: script.id });
  });

  // Indicador: solo se carga solo si está activo Y algún patrón coincide con la URL de la pestaña actual.
  if (ctx.activeUrl) {
    const hit = script.matches.some((pattern) => matchesUrl(pattern, ctx.activeUrl));
    const badge = document.createElement('div');
    badge.className = hit ? 'match-ok' : 'match-no';
    badge.textContent = !hit ? '✖ no coincide con esta pestaña' : script.enabled ? '✔ se carga en esta pestaña' : '○ coincide pero está desactivado';
    info.append(badge);
  }

  const grip = document.createElement('span');
  grip.className = 'grip';
  grip.textContent = '⠿';
  grip.title = 'Arrastra para ordenar o mover de grupo';

  const edit = document.createElement('button');
  edit.className = 'mini';
  edit.textContent = '✎';
  edit.title = 'Editar en Gestionar';
  edit.addEventListener('click', () => openOptions(`#edit=${encodeURIComponent(script.id)}`));

  li.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('input, button')) return;
    if (e.pointerType === 'touch' && !e.target.closest('.grip')) return;
    beginDrag({ id: script.id, name: script.name, startX: e.clientX, startY: e.clientY });
  });

  const top = document.createElement('button');
  top.className = 'mini';
  top.textContent = '⤒';
  top.title = 'Llevar al principio de su grupo';
  top.addEventListener('click', () => sendToTop(script.id));

  li.append(grip, checkbox, info, top, edit, run);
  return li;
}

export async function render() {
  const [scripts, storedGroups, statuses, settings] = await Promise.all([getScripts(), getGroups(), getRunStatus(), getSettings()]);
  const groups = ensureGroupColors(storedGroups).groups;
  toggleAll.hidden = groups.length === 0;
  toggleAll.textContent = groups.some((g) => !g.collapsed) || !settings.ungroupedCollapsed ? '⊟ Contraer' : '⊞ Desplegar';
  list.replaceChildren();
  if (!scripts.length) {
    list.innerHTML = '<li class="empty">Sin scripts. Crea uno en "Gestionar".</li>';
    return;
  }
  for (const section of buildSections(scripts, groups, settings.sort)) {
    const collapsed = section.group ? section.group.collapsed : settings.ungroupedCollapsed;
    if (groups.length && (section.group || section.scripts.length)) list.append(groupHeader(section, collapsed));
    if (collapsed && groups.length) continue;
    section.scripts.forEach((script) => list.append(scriptItem(script, statuses, section.group?.color)));
  }
}
