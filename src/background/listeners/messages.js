import { getScripts } from '../../data/storage.js';
import { isAvailable } from '../availability.js';
import { runScript } from '../executor.js';

export function registerMessages() {
  // Ejecución manual desde la UI: 'run' (un script, ignora estado y patrón) / 'runAll' (todos los activos, ignora patrón).
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      if (message.type === 'status') return { available: await isAvailable() };
      const scripts = await getScripts();
      if (message.type === 'run') {
        const script = scripts.find((s) => s.id === message.scriptId);
        return script ? { results: [await runScript(message.tabId, script, 'manual')] } : { results: [] };
      }
      if (message.type === 'runAll') {
        const results = [];
        for (const script of scripts.filter((s) => s.enabled)) results.push(await runScript(message.tabId, script, 'manual'));
        return { results };
      }
      return {};
    })().then(sendResponse, (error) => sendResponse({ error: error.message }));
    return true;
  });
}
