import { getScripts, setScripts, getErrors } from './storage.js';

const els = {
  items: document.getElementById('items'),
  name: document.getElementById('name'),
  matches: document.getElementById('matches'),
  code: document.getElementById('code'),
  enabled: document.getElementById('enabled'),
  warning: document.getElementById('warning')
};
let selectedId = null;

function clearEditor() {
  selectedId = null;
  els.name.value = '';
  els.matches.value = '<all_urls>';
  els.code.value = "console.log('Script Manager: script ejecutado en', location.href);";
  els.enabled.checked = true;
}

async function renderList() {
  const [scripts, errors] = await Promise.all([getScripts(), getErrors()]);
  els.items.replaceChildren();
  for (const script of scripts) {
    const item = document.createElement('div');
    item.className = 'item' + (script.id === selectedId ? ' active' : '');
    const label = document.createElement('span');
    label.textContent = (script.enabled ? '● ' : '○ ') + script.name + (errors[script.id] ? ' ⚠' : '');
    item.append(label);
    item.addEventListener('click', () => select(script.id));
    els.items.append(item);
  }
}

async function select(id) {
  const script = (await getScripts()).find((s) => s.id === id);
  if (!script) return;
  selectedId = id;
  els.name.value = script.name;
  els.matches.value = script.matches.join('\n');
  els.code.value = script.code;
  els.enabled.checked = script.enabled;
  renderList();
}

document.getElementById('newScript').addEventListener('click', () => { clearEditor(); renderList(); });

document.getElementById('save').addEventListener('click', async () => {
  const scripts = await getScripts();
  const data = {
    name: els.name.value.trim() || 'Sin nombre',
    matches: els.matches.value.split('\n').map((m) => m.trim()).filter(Boolean),
    code: els.code.value,
    enabled: els.enabled.checked
  };
  if (!data.matches.length) data.matches = ['<all_urls>'];
  const existing = scripts.find((s) => s.id === selectedId);
  if (existing) {
    Object.assign(existing, data);
  } else {
    selectedId = crypto.randomUUID();
    scripts.push({ id: selectedId, ...data });
  }
  await setScripts(scripts);
});

document.getElementById('remove').addEventListener('click', async () => {
  if (!selectedId) return;
  await setScripts((await getScripts()).filter((s) => s.id !== selectedId));
  clearEditor();
});

chrome.storage.onChanged.addListener(renderList);

try {
  await chrome.userScripts.getScripts();
} catch {
  els.warning.hidden = false;
  els.warning.textContent = 'Activa "Permitir scripts de usuario" en chrome://extensions > Detalles de esta extensión.';
}
clearEditor();
renderList();
