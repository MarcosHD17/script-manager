import { getScripts, setScripts, getRunStatus } from './storage.js';

const list = document.getElementById('list');
const warning = document.getElementById('warning');
document.getElementById('title').textContent = `Script Manager v${chrome.runtime.getManifest().version}`;

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function checkStatus() {
  const status = await chrome.runtime.sendMessage({ type: 'status' });
  warning.hidden = !!status?.available;
  if (!status?.available) {
    warning.textContent = 'Activa "Permitir scripts de usuario" en chrome://extensions > Detalles de esta extensión y requiere Chrome 135+.';
  }
}

function formatStatus(entry) {
  const time = new Date(entry.time).toLocaleTimeString();
  return entry.ok ? `✔ ${time} (${entry.trigger})` : `✖ ${time}: ${entry.error}`;
}

async function render() {
  const [scripts, statuses] = await Promise.all([getScripts(), getRunStatus()]);
  list.replaceChildren();
  if (!scripts.length) {
    list.innerHTML = '<li class="empty">Sin scripts. Crea uno en "Gestionar".</li>';
    return;
  }
  for (const script of scripts) {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.title = 'Activar en carga automática';
    checkbox.checked = script.enabled;
    checkbox.addEventListener('change', async () => {
      const current = await getScripts();
      const target = current.find((s) => s.id === script.id);
      if (target) target.enabled = checkbox.checked;
      await setScripts(current);
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
    run.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'run', tabId: await getActiveTabId(), scriptId: script.id });
    });

    li.append(checkbox, info, run);
    list.append(li);
  }
}

document.getElementById('runAll').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'runAll', tabId: await getActiveTabId() });
});
document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener(render);
checkStatus();
render();
