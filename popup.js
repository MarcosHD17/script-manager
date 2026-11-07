import { getScripts, setScripts, getRunStatus, getGroups, setGroups, getSettings, setSettings } from './storage.js';
import { buildSections, setEnabled, enabledState, ensureGroupColors, moveMany, bakeOrder, orderGroups, setAllCollapsed, togglePinned, moveGroupsTo, moveGroupToTop, moveToTop } from './organize.js';
import { exportAll, importFiles } from './io.js';
import { matchesUrl } from './match.js';
import { initTheme } from './theme.js';

const list = document.getElementById('list');
const warning = document.getElementById('warning');
document.getElementById('title').textContent = `Script Manager v${chrome.runtime.getManifest().version}`;

let available = true;
let activeUrl = '';
let drag = null;
const toggleAll = document.getElementById('toggleAll');
const DRAG_THRESHOLD = 5;

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// Muestra una alerta visible con acceso directo a los ajustes si falta el permiso.
async function checkStatus() {
  const status = await chrome.runtime.sendMessage({ type: 'status' });
  available = !!status?.available;
  warning.hidden = available;
  document.getElementById('runAll').disabled = !available;
  if (available) return;
  warning.className = 'alert';
  warning.replaceChildren();
  const text = document.createElement('div');
  text.textContent = '⚠ Falta un permiso: activa "Permitir scripts de usuario" en los detalles de esta extensión (requiere Chrome 135+) y recarga la pestaña.';
  const open = document.createElement('button');
  open.textContent = 'Abrir ajustes de la extensión';
  open.addEventListener('click', () => chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }));
  warning.append(text, open);
}

// Botón de activación (reemplaza a la casilla): estados 'all' (ON), 'some' (MIX) y 'none' (OFF).
function toggleButton(state, title, onClick) {
  const button = document.createElement('button');
  button.className = `tgl ${state}`;
  button.textContent = state === 'all' ? 'ON' : state === 'some' ? 'MIX' : 'OFF';
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

// Lleva un script al principio de su grupo (con un orden automático pasa antes a Manual).
async function sendToTop(id) {
  const [scripts, groups, settings] = await Promise.all([getScripts(), getGroups(), getSettings()]);
  let base = scripts;
  if (settings.sort !== 'manual') {
    base = bakeOrder(scripts, ensureGroupColors(groups).groups, settings.sort);
    await setSettings({ ...settings, sort: 'manual' });
  }
  await setScripts(moveToTop(base, id));
}

function formatStatus(entry) {
  const time = new Date(entry.time).toLocaleTimeString();
  return entry.ok ? `✔ ${time} (${entry.trigger})` : `✖ ${time}: ${entry.error}`;
}

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
      drag = { kind: 'group', id: group.id, name: group.name, startX: e.clientX, startY: e.clientY, active: false, drop: null };
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
  run.disabled = !available;
  run.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'run', tabId: await getActiveTabId(), scriptId: script.id });
  });

  // Indicador: solo se carga solo si está activo Y algún patrón coincide con la URL de la pestaña actual.
  if (activeUrl) {
    const hit = script.matches.some((pattern) => matchesUrl(pattern, activeUrl));
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
    drag = { id: script.id, name: script.name, startX: e.clientX, startY: e.clientY, active: false, drop: null };
  });

  const top = document.createElement('button');
  top.className = 'mini';
  top.textContent = '⤒';
  top.title = 'Llevar al principio de su grupo';
  top.addEventListener('click', () => sendToTop(script.id));

  li.append(grip, checkbox, info, top, edit, run);
  return li;
}

async function render() {
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


function openOptions(hash = '') {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') + hash });
}

// ----- Arrastre con eventos de puntero (ordenar y mover entre grupos) -----
function clearDropMarks() {
  list.querySelectorAll('.drop-before, .drop-after, .drop-into').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
}

function endDragUI() {
  clearDropMarks();
  document.querySelector('.drag-ghost')?.remove();
  document.body.classList.remove('is-dragging');
  list.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
}

function updateDropTarget(e) {
  clearDropMarks();
  drag.drop = null;
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('li[data-id], li.group-head');
  if (!target) return;
  if (drag.kind === 'group') {
    const targetGroupId = target.dataset.id ? target.dataset.group : target.dataset.groupId;
    if (!targetGroupId || targetGroupId === drag.id) return;
    const anchor = list.querySelector(`li.group-head[data-group-id="${CSS.escape(targetGroupId)}"]`) ?? target;
    const rect = anchor.getBoundingClientRect();
    const after = e.clientY >= rect.top + rect.height / 2;
    drag.drop = { targetGroupId, where: after ? 'after' : 'before' };
    anchor.classList.add(after ? 'drop-after' : 'drop-before');
    return;
  }
  if (target.dataset.id) {
    if (target.dataset.id === drag.id) return;
    const rect = target.getBoundingClientRect();
    const after = e.clientY >= rect.top + rect.height / 2;
    drag.drop = { targetId: target.dataset.id, where: after ? 'after' : 'before', groupId: target.dataset.group || null };
    target.classList.add(after ? 'drop-after' : 'drop-before');
  } else {
    drag.drop = { targetId: null, where: 'end', groupId: target.dataset.groupId || null };
    target.classList.add('drop-into');
  }
}

function autoScroll(e) {
  const rect = list.getBoundingClientRect();
  if (e.clientY < rect.top + 30) list.scrollTop -= 12;
  else if (e.clientY > rect.bottom - 30) list.scrollTop += 12;
}

async function commitDrop({ id, drop, kind }) {
  if (!drop) return;
  if (kind === 'group') return setGroups(moveGroupsTo(await getGroups(), [id], drop.targetGroupId, drop.where));
  const [scripts, groups, settings] = await Promise.all([getScripts(), getGroups(), getSettings()]);
  let base = scripts;
  // Con un orden automático, soltar en una posición concreta pasa a Manual conservando lo que se veía.
  if (settings.sort !== 'manual' && drop.targetId) {
    base = bakeOrder(scripts, ensureGroupColors(groups).groups, settings.sort);
    await setSettings({ ...settings, sort: 'manual' });
  }
  await setScripts(moveMany(base, [id], drop));
}

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
    drag.active = true;
    list.querySelector(drag.kind === 'group' ? `li.group-head[data-group-id="${CSS.escape(drag.id)}"]` : `li[data-id="${CSS.escape(drag.id)}"]`)?.classList.add('dragging');
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = drag.kind === 'group' ? `📁 ${drag.name}` : drag.name;
    document.body.append(ghost);
    document.body.classList.add('is-dragging');
  }
  const ghost = document.querySelector('.drag-ghost');
  if (ghost) { ghost.style.left = `${e.clientX + 12}px`; ghost.style.top = `${e.clientY + 8}px`; }
  updateDropTarget(e);
  autoScroll(e);
});
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const finished = drag;
  drag = null;
  if (!finished.active) return;
  endDragUI();
  commitDrop(finished);
});
document.addEventListener('pointercancel', () => { drag = null; endDragUI(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag?.active) { drag = null; endDragUI(); } });

// ----- Importar, exportar y plegar todo -----
const msg = document.getElementById('msg');
const importFile = document.getElementById('importFile');
function notify(text, kind = 'ok') { msg.hidden = false; msg.className = kind === 'ok' ? 'ok' : 'alert'; msg.textContent = text; }
document.getElementById('exportAll').addEventListener('click', async () => {
  const count = await exportAll();
  notify(count ? `Exportados ${count} scripts.` : 'No hay scripts para exportar.', count ? 'ok' : 'alert');
});
document.getElementById('importBtn').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const result = await importFiles([...importFile.files]);
  importFile.value = '';
  notify(result.message, result.ok ? 'ok' : 'alert');
});
toggleAll.addEventListener('click', async () => {
  const [groups, settings] = await Promise.all([getGroups(), getSettings()]);
  const collapse = groups.some((g) => !g.collapsed) || !settings.ungroupedCollapsed;
  await setGroups(setAllCollapsed(groups, collapse));
  await setSettings({ ...settings, ungroupedCollapsed: collapse });
});

// ----- Crear un script nuevo desde el popup -----
const newForm = document.getElementById('newForm');
document.getElementById('newScript').addEventListener('click', () => {
  newForm.hidden = !newForm.hidden;
  if (newForm.hidden) return;
  let origin = '';
  try { origin = new URL(activeUrl).origin; } catch { /* pestaña sin URL web */ }
  document.getElementById('newMatches').value = /^https?:/.test(origin) ? `${origin}/*` : '<all_urls>';
  document.getElementById('newCode').value = "console.log('Script Manager: script ejecutado en', location.href);";
  document.getElementById('newName').focus();
});
document.getElementById('newCancel').addEventListener('click', () => { newForm.hidden = true; });
newForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const matches = document.getElementById('newMatches').value.split(/[\n,]/).map((m) => m.trim()).filter(Boolean);
  const now = Date.now();
  const script = {
    id: crypto.randomUUID(),
    name: document.getElementById('newName').value.trim() || 'Sin nombre',
    matches: matches.length ? matches : ['<all_urls>'],
    code: document.getElementById('newCode').value,
    enabled: true,
    grants: [],
    group: null,
    createdAt: now,
    updatedAt: now
  };
  await setScripts([...(await getScripts()), script]);
  document.getElementById('newName').value = '';
  newForm.hidden = true;
});

document.getElementById('runAll').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'runAll', tabId: await getActiveTabId() });
});
document.getElementById('openOptions').addEventListener('click', () => openOptions());
chrome.storage.onChanged.addListener(render);

const settingButtons = [['dock', 'Agrupar flotantes en una lista (si hay 2 o más)'], ['auto', 'Detectar flotantes automáticamente']];
async function renderSettings() {
  const settings = await getSettings();
  const box = document.getElementById('opts');
  box.replaceChildren(...settingButtons.map(([key, label]) => {
    const button = document.createElement('button');
    button.className = `tgl opt-btn ${settings[key] ? 'all' : 'none'}`;
    button.textContent = `${settings[key] ? '●' : '○'} ${label}`;
    button.addEventListener('click', async () => setSettings({ ...(await getSettings()), [key]: !settings[key] }));
    return button;
  }));
}
renderSettings();
chrome.storage.onChanged.addListener(renderSettings);

initTheme();
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => { activeUrl = tab?.url ?? ''; }).catch(() => {})
  .finally(() => checkStatus().then(render));
