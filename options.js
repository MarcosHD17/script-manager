import {
  getScripts, setScripts, getRunStatus, getGroups, setGroups, getHistory, setHistory, getSettings, setSettings
} from './storage.js';
import { buildExport, parseImport, mergeScripts } from './transfer.js';
import { parseMetadata, buildUserScript } from './metadata.js';
import {
  SORT_MODES, buildSections, moveMany, shiftScript, moveGroup, setEnabled, enabledState, duplicateScript,
  assignGroupsByName, bakeOrder, rangeIds, ensureGroupColors, nextGroupColor
} from './organize.js';
import { addVersion, ensureVersions, diffLines, collapseContext, comparableText } from './versions.js';
import { THEMES, initTheme, applyTheme } from './theme.js';

const $ = (id) => document.getElementById(id);
const els = {
  items: $('items'), name: $('name'), group: $('group'), matches: $('matches'), code: $('code'), enabled: $('enabled'),
  grants: $('grants'), note: $('note'), warning: $('warning'), message: $('message'), sort: $('sortMode'),
  theme: $('themeSelect'), historyList: $('historyList'), historyCount: $('historyCount'), diffView: $('diffView'),
  importFile: $('importFile'), search: $('search'), selectAll: $('selectAll'), selCount: $('selCount'),
  bulkBar: $('bulkBar'), bulkCount: $('bulkCount'), bulkGroup: $('bulkGroup'), bulkOn: $('bulkOn'), bulkOff: $('bulkOff'),
  bulkClear: $('bulkClear'), bulkDelete: $('bulkDelete')
};
let selectedId = null;

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

// ---------- Lista: grupos, selección, orden y arrastre ----------
const selected = new Set(); // ids seleccionados para acciones en masa
let lastClickedId = null;
let visibleIds = []; // ids visibles en el orden en que se muestran (para Mayús + clic)
let drag = null;
let suppressClick = false;
const DRAG_THRESHOLD = 5;

const itemsOf = (ids) => [...els.items.querySelectorAll('.item')].filter((row) => ids.includes(row.dataset.id));

function switchControl(checked, title, onChange) {
  const input = h('input', { type: 'checkbox', checked, title });
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('change', () => onChange(input.checked));
  return { input, node: h('label', { class: 'switch', title, onclick: (e) => e.stopPropagation() }, input, h('span', { class: 'slider' })) };
}

async function createGroup(name) {
  const groups = await getGroups();
  const group = { id: crypto.randomUUID(), name, collapsed: false, color: nextGroupColor(groups) };
  await setGroups([...groups, group]);
  await refreshGroupOptions();
  return group;
}

async function moveSelectionTo(groupId, label) {
  const ids = [...selected];
  if (!ids.length) return;
  await setScripts(moveMany(await getScripts(), ids, { groupId }));
  if (selectedId && ids.includes(selectedId)) await refreshGroupOptions().then(() => { els.group.value = groupId ?? ''; });
  showMessage(`${ids.length} script(s) movido(s) a ${label}.`);
}

function groupHeader(section, groups) {
  const { group, scripts: shown } = section;
  const ids = shown.map((s) => s.id);
  const selectedCount = ids.filter((id) => selected.has(id)).length;
  const pick = h('input', { type: 'checkbox', checked: ids.length > 0 && selectedCount === ids.length, title: 'Seleccionar los scripts de esta sección' });
  pick.indeterminate = selectedCount > 0 && selectedCount < ids.length;
  pick.addEventListener('change', () => {
    ids.forEach((id) => (pick.checked ? selected.add(id) : selected.delete(id)));
    renderList();
  });
  const master = switchControl(enabledState(shown) === 'all', 'Activar o desactivar todos los de esta sección', async (value) => {
    await setScripts(setEnabled(await getScripts(), ids, value));
  });
  master.input.indeterminate = enabledState(shown) === 'some';

  const toggle = async () => {
    if (!group) return;
    await setGroups((await getGroups()).map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)));
  };
  const row = h('div', { class: 'group-row' }, pick);
  row.dataset.groupId = group?.id ?? '';
  if (group) {
    const color = h('input', { type: 'color', class: 'gcolor', value: group.color, title: 'Color del grupo' });
    color.addEventListener('click', (e) => e.stopPropagation());
    color.addEventListener('change', async () => {
      await setGroups((await getGroups()).map((g) => (g.id === group.id ? { ...g, color: color.value } : g)));
    });
    row.append(h('button', { class: 'mini', textContent: group.collapsed ? '▸' : '▾', title: 'Plegar o desplegar', onclick: toggle }), color);
  }
  row.append(h('span', { class: 'gname', textContent: group ? `📁 ${group.name}` : 'Sin grupo', onclick: toggle }),
    h('span', { class: 'count', textContent: String(shown.length) }));
  if (group) {
    const index = groups.findIndex((g) => g.id === group.id);
    row.append(
      h('button', { class: 'mini', textContent: '▲', title: 'Subir grupo', disabled: index === 0, onclick: async () => setGroups(moveGroup(await getGroups(), group.id, -1)) }),
      h('button', { class: 'mini', textContent: '▼', title: 'Bajar grupo', disabled: index === groups.length - 1, onclick: async () => setGroups(moveGroup(await getGroups(), group.id, 1)) }),
      h('button', { class: 'mini', textContent: '✎', title: 'Renombrar', onclick: () => renameGroup(group) }),
      h('button', { class: 'mini', textContent: '🗑', title: 'Eliminar grupo', onclick: () => deleteGroup(group) })
    );
  }
  row.append(master.node);
  return row;
}

function rangeSelect(toId) {
  rangeIds(visibleIds, lastClickedId, toId).forEach((id) => selected.add(id));
  renderList();
}

function scriptRow(script, statuses, manual) {
  const failed = statuses[script.id]?.ok === false;
  const pick = h('input', { type: 'checkbox', class: 'sel', checked: selected.has(script.id), title: 'Seleccionar (Mayús: rango)' });
  pick.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.shiftKey && lastClickedId) { e.preventDefault(); rangeSelect(script.id); return; }
    if (pick.checked) selected.add(script.id); else selected.delete(script.id);
    lastClickedId = script.id;
    renderList();
  });
  const row = h('div', { class: 'item' + (script.id === selectedId ? ' active' : '') + (selected.has(script.id) ? ' selected' : '') },
    h('span', { class: 'grip', textContent: '⠿', title: 'Arrastra para ordenar o mover de grupo' }), pick,
    h('span', { class: 'label', textContent: script.name + (failed ? ' ⚠' : '') }));
  row.dataset.id = script.id;
  row.dataset.group = script.group ?? '';
  if (script.rev) row.append(h('span', { class: 'badge', textContent: `v${script.rev}`, title: 'Versión' }));
  if (script.grants?.length) row.append(h('span', { class: 'badge', textContent: 'GM', title: script.grants.join(', ') }));
  if (manual) {
    for (const [symbol, direction] of [['▲', -1], ['▼', 1]]) {
      const button = h('button', { class: 'mini', textContent: symbol, title: direction < 0 ? 'Subir' : 'Bajar' });
      button.addEventListener('click', async (e) => { e.stopPropagation(); await setScripts(shiftScript(await getScripts(), script.id, direction)); });
      row.append(button);
    }
  }
  row.append(switchControl(script.enabled, 'Activo', async (value) => {
    await setScripts(setEnabled(await getScripts(), [script.id], value));
  }).node);

  row.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (selected.has(script.id)) selected.delete(script.id); else selected.add(script.id);
      lastClickedId = script.id;
      return renderList();
    }
    if (e.shiftKey && lastClickedId) return rangeSelect(script.id);
    lastClickedId = script.id;
    select(script.id);
  });
  row.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('input, button, .switch')) return;
    if (e.pointerType === 'touch' && !e.target.closest('.grip')) return; // en táctil solo desde el asa
    drag = { id: script.id, name: script.name, startX: e.clientX, startY: e.clientY, active: false, drop: null, ids: [] };
  });
  return row;
}

async function renderList() {
  const [scripts, storedGroups, statuses, settings] = await Promise.all([getScripts(), getGroups(), getRunStatus(), getSettings()]);
  const groups = ensureGroupColors(storedGroups).groups;
  const query = els.search.value.trim().toLowerCase();
  const matches = (s) => !query || s.name.toLowerCase().includes(query) || s.matches.join(' ').toLowerCase().includes(query);
  const manual = settings.sort === 'manual';
  const sections = buildSections(scripts, groups, settings.sort).map((s) => ({ ...s, scripts: s.scripts.filter(matches) }));

  els.items.replaceChildren();
  visibleIds = [];
  for (const section of sections) {
    if (query && section.scripts.length === 0) continue;
    const container = groups.length ? h('div', { class: 'section' + (section.group ? '' : ' none') }) : els.items;
    if (groups.length) {
      if (section.group) container.style.setProperty('--gcolor', section.group.color);
      container.append(groupHeader(section, groups));
      els.items.append(container);
    }
    if (section.group?.collapsed) continue;
    for (const script of section.scripts) {
      container.append(scriptRow(script, statuses, manual));
      visibleIds.push(script.id);
    }
  }
  if (!scripts.length) els.items.append(h('div', { class: 'empty', textContent: 'Sin scripts. Pega uno en el editor o impórtalo.' }));
  else if (!visibleIds.length) els.items.append(h('div', { class: 'empty', textContent: 'Ningún script coincide con la búsqueda.' }));

  const existing = new Set(scripts.map((s) => s.id));
  for (const id of [...selected]) if (!existing.has(id)) selected.delete(id);
  updateBulkBar(groups);
}

function updateBulkBar(groups) {
  const count = selected.size;
  els.bulkBar.hidden = count === 0;
  els.bulkCount.textContent = `${count} seleccionado${count === 1 ? '' : 's'}`;
  els.bulkGroup.replaceChildren(
    h('option', { value: '', textContent: 'Mover a grupo…' }),
    h('option', { value: '__none', textContent: '(sin grupo)' }),
    ...groups.map((g) => h('option', { value: g.id, textContent: `📁 ${g.name}` })),
    h('option', { value: '__new', textContent: '➕ Nuevo grupo con la selección…' })
  );
  const inView = visibleIds.filter((id) => selected.has(id)).length;
  els.selectAll.checked = visibleIds.length > 0 && inView === visibleIds.length;
  els.selectAll.indeterminate = inView > 0 && inView < visibleIds.length;
  els.selCount.textContent = visibleIds.length ? `${visibleIds.length} visibles` : '';
}

// ----- Acciones en masa -----
els.selectAll.addEventListener('change', () => {
  visibleIds.forEach((id) => (els.selectAll.checked ? selected.add(id) : selected.delete(id)));
  renderList();
});
els.search.addEventListener('input', renderList);
els.bulkGroup.addEventListener('change', async () => {
  const value = els.bulkGroup.value;
  els.bulkGroup.value = '';
  if (!value) return;
  if (value === '__new') return newGroupFromSelection();
  const groupId = value === '__none' ? null : value;
  const group = (await getGroups()).find((g) => g.id === groupId);
  await moveSelectionTo(groupId, group ? `"${group.name}"` : 'sin grupo');
});
els.bulkOn.addEventListener('click', async () => setScripts(setEnabled(await getScripts(), [...selected], true)));
els.bulkOff.addEventListener('click', async () => setScripts(setEnabled(await getScripts(), [...selected], false)));
els.bulkClear.addEventListener('click', () => { selected.clear(); renderList(); });
els.bulkDelete.addEventListener('click', async () => {
  const ids = [...selected];
  if (!ids.length || !confirm(`¿Eliminar ${ids.length} script(s)? También se borra su historial de versiones.`)) return;
  const history = await getHistory();
  ids.forEach((id) => delete history[id]);
  await setHistory(history);
  await setScripts((await getScripts()).filter((s) => !selected.has(s.id)));
  if (ids.includes(selectedId)) clearEditor();
  selected.clear();
  renderList();
  showMessage(`${ids.length} script(s) eliminado(s).`);
});

async function newGroupFromSelection() {
  const name = prompt('Nombre del nuevo grupo:')?.trim();
  if (!name) return;
  const group = await createGroup(name);
  if (selected.size) await moveSelectionTo(group.id, `"${group.name}"`);
  else showMessage(`Grupo "${name}" creado. Arrastra scripts hasta él o elígelo en el editor.`);
}

$('newGroup').addEventListener('click', newGroupFromSelection);
$('newScript').addEventListener('click', () => { clearEditor(); renderList(); });

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

// ----- Arrastre con eventos de puntero (no depende del arrastre nativo del navegador) -----
function clearDropMarks() {
  els.items.querySelectorAll('.drop-before, .drop-after, .drop-into').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
  els.items.classList.remove('drop-end');
}

function endDragUI() {
  clearDropMarks();
  document.querySelector('.drag-ghost')?.remove();
  document.body.classList.remove('is-dragging');
  els.items.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
}

function startDrag() {
  drag.active = true;
  drag.ids = selected.has(drag.id) && selected.size > 1 ? [...selected] : [drag.id];
  itemsOf(drag.ids).forEach((row) => row.classList.add('dragging'));
  document.body.append(h('div', { class: 'drag-ghost', textContent: drag.ids.length > 1 ? `${drag.ids.length} scripts` : drag.name }));
  document.body.classList.add('is-dragging');
}

function updateDropTarget(e) {
  clearDropMarks();
  drag.drop = null;
  const hit = document.elementFromPoint?.(e.clientX, e.clientY);
  const target = hit?.closest?.('.item, .group-row');
  if (target?.classList.contains('item')) {
    if (drag.ids.includes(target.dataset.id)) return;
    const rect = target.getBoundingClientRect();
    const after = e.clientY >= rect.top + rect.height / 2;
    drag.drop = { targetId: target.dataset.id, where: after ? 'after' : 'before', groupId: target.dataset.group || null };
    target.classList.add(after ? 'drop-after' : 'drop-before');
  } else if (target?.classList.contains('group-row')) {
    drag.drop = { targetId: null, where: 'end', groupId: target.dataset.groupId || null };
    target.classList.add('drop-into');
  } else if (hit && els.items.contains(hit)) {
    drag.drop = { targetId: null, where: 'end', groupId: null };
    els.items.classList.add('drop-end');
  }
}

function autoScroll(e) {
  const sidebar = document.querySelector('.sidebar');
  const rect = sidebar.getBoundingClientRect();
  if (e.clientY < rect.top + 40) sidebar.scrollTop -= 14;
  else if (e.clientY > rect.bottom - 40) sidebar.scrollTop += 14;
}

async function commitDrop({ ids, drop }) {
  if (!drop || (drop.targetId && ids.includes(drop.targetId))) return;
  const [scripts, groups, settings] = await Promise.all([getScripts(), getGroups(), getSettings()]);
  let base = scripts;
  // Soltar en una posición concreta con un orden automático: se pasa a Manual conservando lo que se veía.
  if (settings.sort !== 'manual' && drop.targetId) {
    base = bakeOrder(scripts, groups, settings.sort);
    await setSettings({ ...settings, sort: 'manual' });
    showMessage('Orden cambiado a Manual para respetar la posición donde soltaste.');
  }
  await setScripts(moveMany(base, ids, drop));
  const group = groups.find((g) => g.id === drop.groupId);
  const moved = ids.some((id) => (scripts.find((s) => s.id === id)?.group ?? null) !== drop.groupId);
  if (moved) showMessage(`${ids.length} script(s) movido(s) a ${group ? `"${group.name}"` : 'sin grupo'}.`);
}

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
    startDrag();
  }
  const ghost = document.querySelector('.drag-ghost');
  if (ghost) { ghost.style.left = `${e.clientX + 14}px`; ghost.style.top = `${e.clientY + 10}px`; }
  updateDropTarget(e);
  autoScroll(e);
});
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const finished = drag;
  drag = null;
  if (!finished.active) return;
  endDragUI();
  suppressClick = true; // evita que el clic posterior al arrastre abra el script en el editor
  setTimeout(() => { suppressClick = false; }, 80);
  commitDrop(finished);
});
document.addEventListener('pointercancel', () => { drag = null; endDragUI(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (drag?.active) { drag = null; endDragUI(); } else if (selected.size) { selected.clear(); renderList(); }
});
els.items.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);

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
  const colored = ensureGroupColors(await getGroups());
  if (colored.changed) await setGroups(colored.groups);
  await refreshGroupOptions();
  clearEditor();
  await renderList();
  checkAvailability();
  // Enlaces desde el popup: #edit=<id> abre ese script; #new deja el editor listo para uno nuevo.
  const editId = new URLSearchParams(location.hash.slice(1)).get('edit');
  if (editId) await select(editId);
}

chrome.storage.onChanged.addListener(async () => {
  const settings = await getSettings();
  els.sort.value = settings.sort;
  els.theme.value = settings.theme;
  renderList();
});
start();
