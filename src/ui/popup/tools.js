// Importar, exportar y plegar todos los grupos desde el popup.
import { getGroups, setGroups, getSettings, setSettings } from '../../data/storage.js';
import { setAllCollapsed } from '../../core/organize/index.js';
import { exportAll, importFiles } from '../../data/io.js';
import { $ } from '../shared/dom.js';
import { toggleAll, notify } from './dom.js';

export function registerTools() {
  const importFile = $('importFile');
  $('exportAll').addEventListener('click', async () => {
    const count = await exportAll();
    notify(count ? `Exportados ${count} scripts.` : 'No hay scripts para exportar.', count ? 'ok' : 'alert');
  });
  $('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const result = await importFiles([...importFile.files]);
    importFile.value = '';
    notify(result.message, result.ok ? 'ok' : 'alert');
  });
  toggleAll.addEventListener('click', async () => {
    const [groups, settings] = await Promise.all([getGroups(), getSettings()]);
    const collapse = groups.some((g) => !g.collapsed) || !settings.ungroupedCollapsed;
    await setGroups(setAllCollapsed(groups, collapse));
    await setSettings({ ...settings, ungroupedCollapsed: collapse });
  });
}
