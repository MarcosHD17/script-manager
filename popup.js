import { getScripts, setScripts, getErrors } from './storage.js';

const list = document.getElementById('list');
const warning = document.getElementById('warning');

async function checkAvailability() {
  try {
    await chrome.userScripts.getScripts();
  } catch {
    warning.hidden = false;
    warning.textContent = 'Activa "Permitir scripts de usuario" en chrome://extensions > Detalles de esta extensión (o el modo desarrollador en Chrome < 138).';
  }
}

async function render() {
  const [scripts, errors] = await Promise.all([getScripts(), getErrors()]);
  list.replaceChildren();
  if (!scripts.length) {
    list.innerHTML = '<li class="empty">Sin scripts. Crea uno en "Gestionar".</li>';
    return;
  }
  for (const script of scripts) {
    const li = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
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
    if (errors[script.id]) {
      const err = document.createElement('div');
      err.className = 'err';
      err.textContent = errors[script.id];
      info.append(err);
    }
    li.append(checkbox, info);
    list.append(li);
  }
}

document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener(render);
checkAvailability();
render();
