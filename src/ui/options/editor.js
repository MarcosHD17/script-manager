// Editor de scripts: abrir, guardar y acciones (guardar, duplicar, copiar, eliminar, cabecera ==UserScript==).
import { getScripts, setScripts, getHistory, setHistory } from '../../data/storage.js';
import { addVersion } from '../../core/versions.js';
import { duplicateScript } from '../../core/organize/index.js';
import { parseMetadata, buildUserScript } from '../../core/metadata.js';
import { $ } from '../shared/dom.js';
import { els, showMessage } from './dom.js';
import { state, hooks } from './state.js';
import { readEditor, refreshGroupOptions, applyHeader } from './editor-form.js';
import { renderHistory } from './history.js';

export function clearEditor() {
  state.selectedId = null;
  els.name.value = '';
  els.matches.value = '<all_urls>';
  els.code.value = "console.log('Script Manager: script ejecutado en', location.href);";
  els.enabled.checked = true;
  els.grants.value = '';
  els.note.value = '';
  els.group.value = '';
  renderHistory();
}

export async function select(id) {
  const script = (await getScripts()).find((s) => s.id === id);
  if (!script) return;
  state.selectedId = id;
  await refreshGroupOptions();
  els.name.value = script.name;
  els.matches.value = script.matches.join('\n');
  els.code.value = script.code;
  els.enabled.checked = script.enabled;
  els.grants.value = (script.grants ?? []).join(', ');
  els.group.value = script.group ?? '';
  els.note.value = '';
  await renderHistory();
  hooks.renderList();
}

export async function saveScript({ note = els.note.value.trim() } = {}) {
  const [scripts, history] = await Promise.all([getScripts(), getHistory()]);
  const now = Date.now();
  const { repaired, invalid, ...fields } = readEditor();
  if (invalid.length) {
    showMessage(`Patrón de URL inválido: ${invalid.join(', ')}. Formato: https://sitio.com/* · https://*.sitio.com/* · <all_urls>`, 'alert');
    return null;
  }
  if (repaired.length) els.matches.value = fields.matches.join('\n'); // deja visibles los patrones ya normalizados
  const index = scripts.findIndex((s) => s.id === state.selectedId);
  let script;
  if (index >= 0) {
    script = { ...scripts[index], ...fields, updatedAt: now };
    scripts[index] = script;
  } else {
    state.selectedId = crypto.randomUUID();
    script = { id: state.selectedId, ...fields, createdAt: now, updatedAt: now };
    scripts.push(script);
  }
  const result = addVersion(history, script, note, now);
  script.rev = result.version ? result.version.rev : (result.history[script.id]?.[0]?.rev ?? 1);
  await setHistory(result.history);
  await setScripts(scripts);
  els.note.value = '';
  await renderHistory(result.history);
  return { script, repaired };
}

export function registerEditorActions() {
  // ---------- Acciones del editor ----------
  $('save').addEventListener('click', async () => {
    const saved = await saveScript();
    if (!saved) return;
    const fixed = saved.repaired.length ? ` Patrones corregidos: ${saved.repaired.join('; ')}.` : '';
    showMessage(`Guardado (v${saved.script.rev}).${fixed} Recarga las pestañas abiertas para aplicar los cambios.`);
  });

  $('duplicate').addEventListener('click', async () => {
    if (!state.selectedId) return showMessage('Guarda o selecciona un script para duplicarlo.', 'alert');
    const [scripts, history] = await Promise.all([getScripts(), getHistory()]);
    const original = scripts.find((s) => s.id === state.selectedId);
    const { scripts: next, copy } = duplicateScript(scripts, state.selectedId);
    if (!copy) return;
    const result = addVersion(history, copy, `Duplicado de ${original.name}`);
    copy.rev = result.version.rev;
    await setHistory(result.history);
    await setScripts(next);
    await select(copy.id);
    showMessage(`Duplicado como "${copy.name}" (desactivado). Se copió la versión guardada.`);
  });

  $('copyScript').addEventListener('click', async () => {
    const stored = (await getScripts()).find((s) => s.id === state.selectedId);
    const text = buildUserScript({ ...readEditor(), rev: stored?.rev });
    try {
      await navigator.clipboard.writeText(text);
      showMessage('Copiado al portapapeles como userscript: puedes pegarlo en un script nuevo.');
    } catch (error) {
      showMessage(`No se pudo copiar: ${error.message}`, 'alert');
    }
  });

  $('remove').addEventListener('click', async () => {
    if (!state.selectedId) return;
    const name = els.name.value;
    if (!confirm(`¿Eliminar "${name}"? También se borra su historial de versiones.`)) return;
    const history = await getHistory();
    delete history[state.selectedId];
    await setHistory(history);
    await setScripts((await getScripts()).filter((s) => s.id !== state.selectedId));
    clearEditor();
    hooks.renderList();
  });

  $('readHeader').addEventListener('click', () => {
    const meta = parseMetadata(els.code.value);
    if (!meta) return showMessage('No se encontró una cabecera ==UserScript== en el código.', 'alert');
    showMessage(`Cabecera aplicada. ${applyHeader(meta)}. Guarda para confirmar.`, meta.invalid.length ? 'alert' : 'ok');
  });

  // Pegar un userscript completo: aplica la cabecera y, si el script es nuevo, lo guarda y lo deja activo.
  els.code.addEventListener('paste', () => setTimeout(async () => {
    const meta = parseMetadata(els.code.value);
    if (!meta) return;
    const isNew = state.selectedId === null;
    const summary = applyHeader(meta);
    if (!meta.matches.length) return showMessage(`Cabecera aplicada, pero sin patrones @match válidos: añade uno y guarda. ${summary}`, 'alert');
    if (!isNew) return showMessage(`Cabecera aplicada. ${summary}. Guarda para confirmar.`);
    els.enabled.checked = true;
    const saved = await saveScript({ note: 'Pegado' });
    if (!saved) return;
    showMessage(`"${saved.script.name}" guardado y activo. ${summary}. Recarga la pestaña donde lo quieras usar.`);
  }, 0));
}
