// Panel de historial de versiones: listar, comparar, restaurar y borrar.
import { getScripts, setScripts, getHistory, setHistory } from '../../data/storage.js';
import { addVersion, removeVersion, diffLines, collapseContext, comparableText } from '../../core/versions.js';
import { h, formatDate } from '../shared/dom.js';
import { els, showMessage } from './dom.js';
import { state, hooks } from './state.js';
import { readEditor } from './editor-form.js';

export async function renderHistory(historyArg) {
  const history = historyArg ?? await getHistory();
  const versions = state.selectedId ? (history[state.selectedId] ?? []) : [];
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
  const script = scripts.find((s) => s.id === state.selectedId);
  if (!script) return;
  const now = Date.now();
  Object.assign(script, { name: version.name, grants: [...version.grants], code: version.code, updatedAt: now });
  const result = addVersion(history, script, `Restaurada desde v${version.rev}`, now);
  if (result.version) script.rev = result.version.rev;
  await setHistory(result.history);
  await setScripts(scripts);
  await hooks.select(script.id);
  showMessage(`Restaurada la v${version.rev}${result.version ? ` como v${result.version.rev}` : ' (ya era la versión actual)'}.`);
}

async function deleteVersion(version) {
  const [scripts, history] = await Promise.all([getScripts(), getHistory()]);
  // Se renumera de forma contigua para no dejar huecos ni saltarse un número en la siguiente versión.
  const result = removeVersion(history, state.selectedId, version.rev);
  await setHistory(result.history);
  const script = scripts.find((s) => s.id === state.selectedId);
  if (script && result.rev) {
    script.rev = result.rev;
    await setScripts(scripts);
  }
  await renderHistory(result.history);
}
