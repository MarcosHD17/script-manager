import { getScripts, setScripts, getRunStatus, getGroups, setGroups, getSettings, setSettings } from './storage.js';
import { buildSections, setEnabled, enabledState, ensureGroupColors } from './organize.js';
import { initTheme } from './theme.js';

const list = document.getElementById('list');
const warning = document.getElementById('warning');
document.getElementById('title').textContent = `Script Manager v${chrome.runtime.getManifest().version}`;

let available = true;

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

function formatStatus(entry) {
  const time = new Date(entry.time).toLocaleTimeString();
  return entry.ok ? `✔ ${time} (${entry.trigger})` : `✖ ${time}: ${entry.error}`;
}

function groupHeader(section) {
  const group = section.group;
  const state = enabledState(section.scripts);
  const master = document.createElement('input');
  master.type = 'checkbox';
  master.checked = state === 'all';
  master.indeterminate = state === 'some';
  master.title = 'Activar o desactivar todos';
  master.addEventListener('change', async () => {
    await setScripts(setEnabled(await getScripts(), section.scripts.map((s) => s.id), master.checked));
  });

  const toggle = document.createElement('button');
  toggle.className = 'mini';
  toggle.textContent = group?.collapsed ? '▸' : '▾';
  toggle.addEventListener('click', async () => {
    if (!group) return;
    await setGroups((await getGroups()).map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)));
  });

  const name = document.createElement('span');
  name.textContent = group ? `📁 ${group.name}` : 'Sin grupo';
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = String(section.scripts.length);

  const li = document.createElement('li');
  li.className = 'group-head';
  if (group) li.style.setProperty('--gcolor', group.color);
  li.append(master, toggle, name, count);
  return li;
}

function scriptItem(script, statuses, color) {
  const li = document.createElement('li');
  if (color) {
    li.classList.add('in-group');
    li.style.setProperty('--gcolor', color);
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.title = 'Activar en carga automática';
  checkbox.checked = script.enabled;
  checkbox.addEventListener('change', async () => {
    await setScripts(setEnabled(await getScripts(), [script.id], checkbox.checked));
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

  li.append(checkbox, info, run);
  return li;
}

async function render() {
  const [scripts, storedGroups, statuses, settings] = await Promise.all([getScripts(), getGroups(), getRunStatus(), getSettings()]);
  const groups = ensureGroupColors(storedGroups).groups;
  list.replaceChildren();
  if (!scripts.length) {
    list.innerHTML = '<li class="empty">Sin scripts. Crea uno en "Gestionar".</li>';
    return;
  }
  for (const section of buildSections(scripts, groups, settings.sort)) {
    if (groups.length && (section.group || section.scripts.length)) list.append(groupHeader(section));
    if (section.group?.collapsed) continue;
    section.scripts.forEach((script) => list.append(scriptItem(script, statuses, section.group?.color)));
  }
}

document.getElementById('runAll').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'runAll', tabId: await getActiveTabId() });
});
document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener(render);

const dockToggle = document.getElementById('dock');
const autoToggle = document.getElementById('auto');
getSettings().then((settings) => { dockToggle.checked = settings.dock; autoToggle.checked = settings.auto; });
dockToggle.addEventListener('change', async () => setSettings({ ...(await getSettings()), dock: dockToggle.checked }));
autoToggle.addEventListener('change', async () => setSettings({ ...(await getSettings()), auto: autoToggle.checked }));

initTheme();
checkStatus().then(render);
