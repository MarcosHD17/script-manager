import { getScripts } from '../../data/storage.js';
import { matchesUrl } from '../../core/match.js';
import { isAvailable } from '../availability.js';
import { runScript } from '../executor.js';

export function registerAutoRun() {
  // Ejecución automática: al terminar de cargar una pestaña, corre los scripts activos cuyo patrón coincida.
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url || !(await isAvailable())) return;
    const scripts = (await getScripts()).filter(
      (s) => s.enabled && s.matches.some((pattern) => matchesUrl(pattern, tab.url))
    );
    for (const script of scripts) await runScript(tabId, script, 'auto');
  });
}
