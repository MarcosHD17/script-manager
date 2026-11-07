import { getScripts, setScripts, getRunStatus } from './storage.js';
import { buildExport, parseImport, mergeScripts } from './transfer.js';

const els = {
  items: document.getElementById('items'),
  name: document.getElementById('name'),
  matches: document.getElementById('matches'),
  code: document.getElementById('code'),
  enabled: document.getElementById('enabled'),
  warning: document.getElementById('warning'),
  message: document.getElementById('message')
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
  const [scripts, errors] = await Promise.all([getScripts(), getRunStatus()]);
  els.items.replaceChildren();
  for (const script of scripts) {
    const item = document.createElement('div');
    item.className = 'item' + (script.id === selectedId ? ' active' : '');
    const label = document.createElement('span');
    label.textContent = (script.enabled ? '● ' : '○ ') + script.name + (errors[script.id]?.ok === false ? ' ⚠' : '');
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

function showMessage(text, kind = 'ok') {
  els.message.hidden = false;
  els.message.className = kind;
  els.message.textContent = text;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const today = () => new Date().toISOString().slice(0, 10);
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'script';

document.getElementById('exportAll').addEventListener('click', async () => {
  const scripts = await getScripts();
  if (!scripts.length) return showMessage('No hay scripts para exportar.', 'alert');
  downloadJson(`script-manager-${today()}.json`, buildExport(scripts));
  showMessage(`Exportados ${scripts.length} scripts.`);
});

document.getElementById('exportOne').addEventListener('click', async () => {
  const script = (await getScripts()).find((s) => s.id === selectedId);
  if (!script) return showMessage('Selecciona un script guardado para exportarlo.', 'alert');
  downloadJson(`script-${slug(script.name)}-${today()}.json`, buildExport([script]));
  showMessage(`Exportado "${script.name}".`);
});

const importFile = document.getElementById('importFile');
document.getElementById('importBtn').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const incoming = [];
  let skipped = 0;
  const errors = [];
  for (const file of importFile.files) {
    try {
      const result = parseImport(await file.text());
      incoming.push(...result.scripts);
      skipped += result.skipped;
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }
  importFile.value = '';
  if (!incoming.length) return showMessage(errors.length ? errors.join(' | ') : 'No se encontraron scripts válidos.', 'alert');

  const existing = await getScripts();
  const duplicates = incoming.filter((item) => existing.some((s) => s.id === item.id)).length;
  const replace = duplicates > 0 && confirm(`${duplicates} script(s) ya existen con el mismo id.\nAceptar = reemplazarlos. Cancelar = importarlos como copia.`);
  const merged = mergeScripts(existing, incoming, replace);
  await setScripts(merged.scripts);
  clearEditor();
  const notes = [`Importados: ${merged.added} nuevos, ${merged.replaced} reemplazados, ${merged.copied} copias`];
  if (skipped) notes.push(`${skipped} omitidos por formato inválido`);
  if (errors.length) notes.push(errors.join(' | '));
  showMessage(`${notes.join('. ')}. Quedan desactivados: revísalos y actívalos.`);
});

chrome.storage.onChanged.addListener(renderList);

try {
  await chrome.userScripts.getScripts();
} catch {
  els.warning.hidden = false;
  els.warning.className = 'alert';
  els.warning.textContent = '⚠ Falta un permiso: activa "Permitir scripts de usuario" en chrome://extensions > Detalles de esta extensión (requiere Chrome 135+).';
}
clearEditor();
renderList();
