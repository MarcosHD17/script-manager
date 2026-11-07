// Importar y exportar desde la página de opciones.
import { getScripts, getGroups, getHistory } from '../../data/storage.js';
import { buildExport } from '../../core/transfer.js';
import { downloadJson, today, slug, exportAll, importFiles } from '../../data/io.js';
import { $ } from '../shared/dom.js';
import { els, showMessage } from './dom.js';
import { state, hooks } from './state.js';

export function registerTransfer() {
  $('exportAll').addEventListener('click', async () => {
    const scripts = await getScripts();
    if (!scripts.length) return showMessage('No hay scripts para exportar.', 'alert');
    await exportAll();
    showMessage(`Exportados ${scripts.length} scripts.`);
  });

  $('exportOne').addEventListener('click', async () => {
    const [scripts, groups, history] = await Promise.all([getScripts(), getGroups(), getHistory()]);
    const script = scripts.find((s) => s.id === state.selectedId);
    if (!script) return showMessage('Selecciona un script guardado para exportarlo.', 'alert');
    downloadJson(`script-${slug(script.name)}-${today()}.json`, buildExport([script], groups, history));
    showMessage(`Exportado "${script.name}".`);
  });

  $('importBtn').addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', async () => {
    const result = await importFiles([...els.importFile.files]);
    els.importFile.value = '';
    if (result.ok) hooks.clearEditor();
    showMessage(result.message, result.ok ? 'ok' : 'alert');
  });
}
