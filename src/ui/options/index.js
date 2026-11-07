// Punto de entrada de la página de opciones: conecta los módulos y arranca.
import { getScripts, setScripts, getGroups, setGroups, getHistory, setHistory, getSettings } from '../../data/storage.js';
import { ensureGroupColors } from '../../core/organize/index.js';
import { ensureVersions } from '../../core/versions.js';
import { initTheme } from '../shared/theme.js';
import { hooks } from './state.js';
import { clearEditor, select, registerEditorActions } from './editor.js';
import { refreshGroupOptions } from './editor-form.js';
import { renderList } from './list.js';
import { registerBulkActions } from './bulk.js';
import { registerDrag } from './drag.js';
import { registerTransfer } from './transfer-ui.js';
import { registerAppearance, syncAppearance } from './appearance.js';
import { checkAvailability } from './availability.js';

// Enlaces entre módulos (evita dependencias circulares).
hooks.renderList = renderList;
hooks.select = select;
hooks.clearEditor = clearEditor;

registerEditorActions();
registerBulkActions();
registerDrag();
registerTransfer();
registerAppearance();

async function start() {
  await initTheme();
  syncAppearance(await getSettings());
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
  // Enlaces desde el popup: #edit=<id> abre ese script.
  const editId = new URLSearchParams(location.hash.slice(1)).get('edit');
  if (editId) await select(editId);
}

chrome.storage.onChanged.addListener(async () => {
  syncAppearance(await getSettings());
  renderList();
});
start();
