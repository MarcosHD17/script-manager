import { getScripts, setScripts } from '../../data/storage.js';
import { DEFAULT_SCRIPTS } from '../../data/defaults.js';

export function registerInstall() {
  chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
    const scripts = await getScripts();
    if (reason === 'install' && scripts.length === 0) {
      await setScripts(DEFAULT_SCRIPTS);
    } else if (reason === 'update' && previousVersion?.localeCompare('0.3.0', undefined, { numeric: true }) < 0) {
      // Añade los ejemplos de componentes flotantes (desactivados) sin tocar los scripts del usuario.
      const missing = DEFAULT_SCRIPTS
        .filter((d) => d.id.startsWith('demo-panel') && !scripts.some((s) => s.id === d.id))
        .map((d) => ({ ...d, enabled: false }));
      if (missing.length) await setScripts([...scripts, ...missing]);
    }
    // Limpia registros persistentes de la v0.1 (userScripts.register) para evitar ejecuciones duplicadas.
    try {
      const registered = await chrome.userScripts.getScripts();
      if (registered.length) await chrome.userScripts.unregister({ ids: registered.map((s) => s.id) });
    } catch { /* API no disponible: se informa en el popup */ }
  });
}
