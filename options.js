import {
  getScripts, setScripts, getRunStatus, getGroups, setGroups, getHistory, setHistory, getSettings, setSettings
} from './storage.js';
import { buildExport, parseImport, mergeScripts } from './transfer.js';
import { parseMetadata, buildUserScript } from './metadata.js';
import {
  SORT_MODES, buildSections, moveScript, shiftScript, moveGroup, setEnabled, enabledState,
  duplicateScript, assignGroupsByName
} from './organize.js';
import { addVersion, ensureVersions, diffLines, collapseContext, comparableText } from './versions.js';
import { THEMES, initTheme, applyTheme } from './theme.js';

const $ = (id) => document.getElementById(id);
const els = {
  items: $('items'), name: $('name'), group: $('group'), matches: $('matches'), code: $('code'), enabled: $('enabled'),
  grants: $('grants'), note: $('note'), warning: $('warning'), message: $('message'), sort: $('sortMode'),
  theme: $('themeSelect'), historyList: $('historyList'), historyCount: $('historyCount'), diffView: $('diffView'),
  importFile: $('importFile')
};
let selectedId = null;
let dragId = null;

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node[key] = value;
  }
  node.append(...children);
  return node;
}

const formatDate = (ms) => new Date(ms).toLocaleString();

function showMessage(text, kind = 'ok') {
  els.message.hidden = false;
  els.message.className = kind;
  els.message.textContent = text;
}

// ---------- Editor ----------
function readEditor() {
  const matches = els.matches.value.split('\n').map((m) => m.trim()).filter(Boolean);
  return {
    name: els.name.value.trim() || 'Sin nombre',
    matches: matches.length ? matches : ['<all_urls>'],
    code: els.code.value,
    enabled: els.enabled.checked,
    grants: els.grants.value.split(',').map((g) => g.trim()).filter((g) => g && g !== 'none'),
    group: els.group.value || null
  };
}

function clearEditor() {
  selectedId = null;
  els.name.value = '';
  els.matches.value = '<all_urls>';
  els.code.value = "console.log('Script Manager: script ejecutado en', location.href);";
  els.enabled.checked = true;
  els.grants.value = '';
  els.note.value = '';
  els.group.value = '';
  renderHistory();
}

async function refreshGroupOptions() {
  const groups = await getGroups();
  const previous = els.group.value;
  els.group.replaceChildren(h('option', { value: '', textContent: '(sin grupo)' }),
    ...groups.map((g) => h('option', { value: g.id, textContent: g.name })));
  els.group.value = groups.some((g) => g.id === previous) ? previous : '';
}

async function select(id) {
  const script = (await getScripts()).find((s) => s.id === id);
  if (!script) return;
  selectedId = id;
  await refreshGroupOptions();
  els.name.value = script.name;
  els.matches.value = script.matches.join('\n');
  els.code.value = script.code;
  els.enabled.checked = script.enabled;
  els.grants.value = (script.grants ?? []).join(', ');
  els.group.value = script.group ?? '';
  els.note.value = '';
  await renderHistory();
  renderList();
}

async function saveScript({ note = els.note.value.trim() } = {}) {
  const [scripts, history] = await Promise.all([getScripts(), getHistory()]);
  const now = Date.now();
  const fields = readEditor();
  const index = scripts.findIndex((s) => s.id === selectedId);
  let script;
  if (index >= 0) {
    script = { ...scripts[index], ...fields, updatedAt: now };
    scripts[index] = script;
  } else {
    selectedId = crypto.randomUUID();
    script = { id: selectedId, ...fields, createdAt: now, updatedAt: now };
    scripts.push(script);
  }
  const result = addVersion(history, script, note, now);
  script.rev = result.version ? result.version.rev : (result.history[script.id]?.[0]?.rev ?? 1);
  await setHistory(result.history);
  await setScripts(scripts);
  els.note.value = '';
  await renderHistory(result.history);
  return script;
}

// ---------- Lista: grupos, orden y arrastrar y soltar ----------
async function dropOn({ targetId = null, where = 'end', groupId = null }) {
  if (!dragId || dragId === targetId) return;
  await setScripts(moveScript(await getScripts(), dragId, { targetId, where, groupId }));
}

function groupHeader(section, scripts, groups) {
  const group = section.group;
  const state = enabledState(section.scripts);
  const master = h('input', { type: 'checkbox', checked: state === 'all', title: 'Activar o desactivar todos los de esta sección' });
  master.indeterminate = state === 'some';
  master.addEventListener('change', async () => {
    await setScripts(setEnabled(await getScripts(), section.scripts.map((s) => s.id), master.checked));
  });
  const arrow = h('button', { class: 'mini', textContent: group?.collapsed ? '▸' : '▾', title: 'Plegar o desplegar' });
  const toggle = async () => {
    if (!group) return;
    await setGroups((await getGroups()).map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)));
  };
  arrow.addEventListener('click', toggle);
  const row = h('div', { class: 'group-row' }, master, arrow,
    h('span', { class: 'gname', textContent: group ? group.name : 'Sin grupo', onclick: toggle }),
    h('span', { class: 'count', textContent: String(section.scripts.length) }));
  if (group) {
    const index = groups.findIndex((g) => g.id === group.id);
    row.append(
      h('button', { class: 'mini', textContent: '▲', title: 'Subir grupo', disabled: index === 0, onclick: async () => setGroups(moveGroup(await getGroups(), group.id, -1)) }),
      h('button', { class: 'mini', textContent: '▼', title: 'Bajar grupo', disabled: index === groups.length - 1, onclick: async () => setGroups(moveGroup(await getGroups(), group.id, 1)) }),
      h('button', { class: 'mini', textContent: '✎', title: 'Renombrar', onclick: () => renameGroup(group) }),
      h('button', { class: 'mini', textContent: '🗑', title: 'Eliminar grupo', onclick: () => deleteGroup(group) })
    );
  }
  row.addEventListener('dragover', (e) => { if (dragId) { e.preventDefault(); row.classList.add('drop-into'); } });
  row.addEventListener('dragleave', () => row.classList.remove('drop-into'));
  row.addEventListener('drop', async (e) => {
    e.preventDefault();
    row.classList.remove('drop-into');
    await dropOn({ groupId: group?.id ?? null });
  });
  return row;
}

function scriptRow(script, statuses, manual) {
  const failed = statuses[script.id]?.ok === false;
  const checkbox = h('input', { type: 'checkbox', checked: script.enabled, title: 'Activo' });
  checkbox.addEventListener('click', (e) => e.stopPropagation());
  checkbox.addEventListener('change', async () => setScripts(setEnabled(await getScripts(), [script.id], checkbox.checked)));
  const label = h('span', { class: 'label', textContent: script.name + (failed ? ' ⚠' : '') });
  const row = h('div', { class: 'item' + (script.id === selectedId ? ' active' : ''), draggable: true }, checkbox, label);
  if (script.rev) row.append(h('span', { class: 'badge', textContent: `v${script.rev}`, title: 'Versión' }));
  if (script.grants?.length) row.append(h('span', { class: 'badge', textContent: 'GM', title: script.grants.join(', ') }));
  if (manual) {
    for (const [symbol, direction] of [['▲', -1], ['▼', 1]]) {
      const button = h('button', { class: 'mini', textContent: symbol, title: direction < 0 ? 'Subir' : 'Bajar' });
      button.addEventListener('click', async (e) => { e.stopPropagation(); await setScripts(shiftScript(await getScripts(), script.id, direction)); });
      row.append(button);
    }
  }
  row.addEventListener('click', () => select(script.id));
  row.addEventListener('dragstart', (e) => { dragId = script.id; e.dataTransfer?.setData('text/plain', script.id); });
  row.addEventListener('dragend', () => { dragId = null; });
  row.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    const after = e.offsetY > row.offsetHeight / 2;
    row.classList.toggle('drop-before', !after);
    row.classList.toggle('drop-after', after);
  });
  row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after'));
  row.addEventListener('drop', async (e) => {
    e.preventDefault();
    const where = row.classList.contains('drop-after') ? 'after' : 'before';
    row.classList.remove('drop-before', 'drop-after');
    await dropOn({ targetId: script.id, where, groupId: script.group ?? null });
  });
  return row;
}

async function renderList() {
  const [scripts, groups, statuses, settings] = await Promise.all([getScripts(), getGroups(), getRunStatus(), getSettings()]);
  const sections = buildSections(scripts, groups, settings.sort);
  els.items.replaceChildren();
  for (const section of sections) {
    if (groups.length) els.items.append(groupHeader(section, scripts, groups));
    if (section.group?.collapsed) continue;
    section.scripts.forEach((script) => els.items.append(scriptRow(script, statuses, settings.sort === 'manual')));
  }
  if (!scripts.length) els.items.append(h('div', { class: 'empty', textContent: 'Sin scripts. Pega uno en el editor o impórtalo.' }));
}

async function renameGroup(group) {
  const name = prompt('Nombre del grupo:', group.name)?.trim();
  if (!name) return;
  await setGroups((await getGroups()).map((g) => (g.id === group.id ? { ...g, name } : g)));
  await refreshGroupOptions();
}

async function deleteGroup(group) {
  if (!confirm(`¿Eliminar el grupo "${group.name}"? Sus scripts pasan a "Sin grupo".`)) return;
  await setScripts((await getScripts()).map((s) => (s.group === group.id ? { ...s, group: null } : s)));
  await setGroups((await getGroups()).filter((g) => g.id !== group.id));
  await refreshGroupOptions();
}

$('newGroup').addEventListener('click', async () => {
  const name = prompt('Nombre del nuevo grupo:')?.trim();
  if (!name) return;
  await setGroups([...(await getGroups()), { id: crypto.randomUUID(), name, collapsed: false }]);
  await refreshGroupOptions();
  showMessage(`Grupo "${name}" creado. Arrastra scripts hasta él o elígelo en el editor.`);
});

$('newScript').addEventListener('click', () => { clearEditor(); renderList(); });

// ---------- Historial de versiones ----------
async function renderHistory(historyArg) {
  const history = historyArg ?? await getHistory();
  const versions = selectedId ? (history[selectedId] ?? []) : [];
  els.historyCount.textContent = String(versions.length);
  els.diffView.hidden = true;
  els.historyList.replaceChildren();
  if (!versions.length) {
    els.historyList.append(h('div', { class: 'empty', textContent: 'Sin versiones: guarda el script para crear la primera.' }));
    return;
  }
  for (const version of versions) {
    const info = h('div', { class: 'version-info' }, h('strong', { textContent: `v${version.rev}` }),
      ` · ${formatDate(version.at)}${version.note ? ` · ${version.note}` : ''}`);
    els.historyList.append(h('div', { class: 'version' }, info, h('span', {},
      h('button', { textContent: 'Comparar', title: 'Comparar con el editor', onclick: () => showDiff(version) }),
      h('button', { textContent: 'Restaurar', onclick: () => restoreVersion(version) }),
      h('button', { class: 'danger', textContent: '🗑', title: 'Borrar versión', disabled: versions.length === 1, onclick: () => deleteVersion(version) }))));
  }
}

function showDiff(version) {
  const ops = collapseContext(diffLines(comparableText(version), comparableText(readEditor())));
  els.diffView.replaceChildren(h('div', { class: 'diff-skip', textContent: `− v${version.rev}    + editor` }));
  if (ops.every((op) => op.type === 'same' || op.type === 'skip')) {
    els.diffView.append(h('div', { textContent: 'Sin diferencias con el editor.' }));
  }
  for (const op of ops) {
    if (op.type === 'skip') els.diffView.append(h('div', { class: 'diff-skip', textContent: `⋯ ${op.count} líneas sin cambios ⋯` }));
    else els.diffView.append(h('div', { class: `diff-${op.type}`, textContent: `${op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' '} ${op.text}` }));
  }
  els.diffView.hidden = false;
}

async function restoreVersion(version) {
  if (!confirm(`¿Restaurar la v${version.rev}? Se guardará como una versión nueva.`)) return;
  const [scripts, history] = await Promise.all([getScripts(), getHistory()]);
  const script = scripts.find((s) => s.id === selectedId);
  if (!script) return;
  const now = Date.now();
  Object.assign(script, { name: version.name, matches: [...version.matches], grants: [...version.grants], code: version.code, updatedAt: now });
  const result = addVersion(history, script, `Restaurada desde v${version.rev}`, now);
  if (result.version) script.rev = result.version.rev;
  await setHistory(result.history);
  await setScripts(scripts);
  await select(script.id);
  showMessage(`Restaurada la v${version.rev}${result.version ? ` como v${result.version.rev}` : ' (ya era la versión actual)'}.`);
}

async function deleteVersion(version) {
  const history = await getHistory();
  const list = (history[selectedId] ?? []).filter((v) => v.rev !== version.rev);
  await setHistory({ ...history, [selectedId]: list });
  await renderHistory();
}

// ---------- Acciones del editor ----------
$('save').addEventListener('click', async () => {
  const script = await saveScript();
  showMessage(`Guardado (v${script.rev}). Recarga las pestañas abiertas para aplicar los cambios.`);
});

$('duplicate').addEventListener('click', async () => {
  if (!selectedId) return showMessage('Guarda o selecciona un script para duplicarlo.', 'alert');
  const [scripts, history] = await Promise.all([getScripts(), getHistory()]);
  const original = scripts.find((s) => s.id === selectedId);
  const { scripts: next, copy } = duplicateScript(scripts, selectedId);
  if (!copy) return;
  const result = addVersion(history, copy, `Duplicado de ${original.name}`);
  copy.rev = result.version.rev;
  await setHistory(result.history);
  await setScripts(next);
  await select(copy.id);
  showMessage(`Duplicado como "${copy.name}" (desactivado). Se copió la versión guardada.`);
});

$('copyScript').addEventListener('click', async () => {
  const stored = (await getScripts()).find((s) => s.id === selectedId);
  const text = buildUserScript({ ...readEditor(), rev: stored?.rev });
  try {
    await navigator.clipboard.writeText(text);
    showMessage('Copiado al portapapeles como userscript: puedes pegarlo en un script nuevo.');
  } catch (error) {
    showMessage(`No se pudo copiar: ${error.message}`, 'alert');
  }
});

$('remove').addEventListener('click', async () => {
  if (!selectedId) return;
  const name = els.name.value;
  if (!confirm(`¿Eliminar "${name}"? También se borra su historial de versiones.`)) return;
  const history = await getHistory();
  delete history[selectedId];
  await setHistory(history);
  await setScripts((await getScripts()).filter((s) => s.id !== selectedId));
  clearEditor();
  renderList();
});

// ---------- Cabecera ==UserScript== ----------
function applyHeader(meta) {
  if (meta.name) els.name.value = meta.name;
  if (meta.matches.length) els.matches.value = meta.matches.join('\n');
  els.grants.value = meta.grants.join(', ');
  const notes = [`Patrones: ${meta.matches.join(', ') || 'ninguno válido'}`];
  if (meta.repaired.length) notes.push(`corregidos: ${meta.repaired.join('; ')}`);
  if (meta.invalid.length) notes.push(`omitidos por inválidos: ${meta.invalid.join(', ')}`);
  if (meta.grants.length) notes.push(`permisos: ${meta.grants.join(', ')}`);
  return notes.join('. ');
}

$('readHeader').addEventListener('click', () => {
  const meta = parseMetadata(els.code.value);
  if (!meta) return showMessage('No se encontró una cabecera ==UserScript== en el código.', 'alert');
  showMessage(`Cabecera aplicada. ${applyHeader(meta)}. Guarda para confirmar.`, meta.invalid.length ? 'alert' : 'ok');
});

// Pegar un userscript completo: aplica la cabecera y, si el script es nuevo, lo guarda y lo deja activo.
els.code.addEventListener('paste', () => setTimeout(async () => {
  const meta = parseMetadata(els.code.value);
  if (!meta) return;
  const isNew = selectedId === null;
  const summary = applyHeader(meta);
  if (!meta.matches.length) return showMessage(`Cabecera aplicada, pero sin patrones @match válidos: añade uno y guarda. ${summary}`, 'alert');
  if (!isNew) return showMessage(`Cabecera aplicada. ${summary}. Guarda para confirmar.`);
  els.enabled.checked = true;
  const saved = await saveScript({ note: 'Pegado' });
  showMessage(`"${saved.name}" guardado y activo. ${summary}. Recarga la pestaña donde lo quieras usar.`);
}, 0));

// ---------- Importar / exportar ----------
const today = () => new Date().toISOString().slice(0, 10);
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'script';

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('exportAll').addEventListener('click', async () => {
  const [scripts, groups] = await Promise.all([getScripts(), getGroups()]);
  if (!scripts.length) return showMessage('No hay scripts para exportar.', 'alert');
  downloadJson(`script-manager-${today()}.json`, buildExport(scripts, groups));
  showMessage(`Exportados ${scripts.length} scripts.`);
});

$('exportOne').addEventListener('click', async () => {
  const [scripts, groups] = await Promise.all([getScripts(), getGroups()]);
  const script = scripts.find((s) => s.id === selectedId);
  if (!script) return showMessage('Selecciona un script guardado para exportarlo.', 'alert');
  downloadJson(`script-${slug(script.name)}-${today()}.json`, buildExport([script], groups));
  showMessage(`Exportado "${script.name}".`);
});

$('importBtn').addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', async () => {
  const incoming = [];
  let skipped = 0;
  const errors = [];
  const invalidPatterns = [];
  const repairedPatterns = [];
  for (const file of els.importFile.files) {
    try {
      const result = parseImport(await file.text(), file.name);
      incoming.push(...result.scripts);
      skipped += result.skipped;
      invalidPatterns.push(...result.invalid);
      repairedPatterns.push(...result.repaired);
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }
  els.importFile.value = '';
  if (!incoming.length) return showMessage(errors.length ? errors.join(' | ') : 'No se encontraron scripts válidos.', 'alert');

  const [existing, groups, history] = await Promise.all([getScripts(), getGroups(), getHistory()]);
  const duplicates = incoming.filter((item) => existing.some((s) => s.id === item.id)).length;
  const replace = duplicates > 0 && confirm(`${duplicates} script(s) ya existen con el mismo id.\nAceptar = reemplazarlos. Cancelar = importarlos como copia.`);
  const merged = mergeScripts(existing, incoming, replace);
  const grouped = assignGroupsByName(merged.scripts, groups);
  const versioned = ensureVersions(grouped.scripts, history, Date.now(), 'Importado');
  await setHistory(versioned.history);
  await setGroups(grouped.groups);
  await setScripts(versioned.scripts);
  clearEditor();
  const notes = [`Importados: ${merged.added} nuevos, ${merged.replaced} reemplazados, ${merged.copied} copias`];
  if (skipped) notes.push(`${skipped} omitidos por formato inválido`);
  if (repairedPatterns.length) notes.push(`Patrones corregidos: ${repairedPatterns.join('; ')}`);
  if (invalidPatterns.length) notes.push(`Patrones @match inválidos omitidos: ${invalidPatterns.join(', ')}`);
  if (errors.length) notes.push(errors.join(' | '));
  showMessage(`${notes.join('. ')}. Quedan desactivados: revísalos y actívalos.`);
});

// ---------- Orden y tema ----------
els.sort.replaceChildren(...SORT_MODES.map((m) => h('option', { value: m.id, textContent: m.label })));
els.theme.replaceChildren(...THEMES.map((t) => h('option', { value: t.id, textContent: t.label })));
els.sort.addEventListener('change', async () => setSettings({ ...(await getSettings()), sort: els.sort.value }));
els.theme.addEventListener('change', async () => {
  applyTheme(els.theme.value);
  await setSettings({ ...(await getSettings()), theme: els.theme.value });
});

// ---------- Arranque ----------
async function checkAvailability() {
  try {
    await chrome.userScripts.getScripts();
  } catch {
    els.warning.hidden = false;
    els.warning.className = 'alert';
    els.warning.textContent = '⚠ Falta un permiso: activa "Permitir scripts de usuario" en los detalles de esta extensión.';
  }
}

async function start() {
  await initTheme();
  const settings = await getSettings();
  els.sort.value = settings.sort;
  els.theme.value = settings.theme;
  // Migración: garantiza versión inicial y marcas de tiempo en los scripts existentes.
  const [scripts, history] = await Promise.all([getScripts(), getHistory()]);
  const ensured = ensureVersions(scripts, history);
  if (ensured.changed) {
    await setHistory(ensured.history);
    await setScripts(ensured.scripts);
  }
  await refreshGroupOptions();
  clearEditor();
  renderList();
  checkAvailability();
}

chrome.storage.onChanged.addListener(async () => {
  const settings = await getSettings();
  els.sort.value = settings.sort;
  els.theme.value = settings.theme;
  renderList();
});
start();
