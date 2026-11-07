import { getScripts, setScripts, setErrors, DEFAULT_SCRIPTS, STORAGE_KEYS } from './storage.js';

async function isUserScriptsAvailable() {
  try {
    await chrome.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}

// Sincroniza los scripts habilitados con la API userScripts (reemplazo total, idempotente).
async function syncScripts() {
  if (!(await isUserScriptsAvailable())) return;

  const scripts = await getScripts();
  const registered = await chrome.userScripts.getScripts();
  if (registered.length) {
    await chrome.userScripts.unregister({ ids: registered.map((s) => s.id) });
  }

  const errors = {};
  for (const script of scripts) {
    if (!script.enabled) continue;
    try {
      await chrome.userScripts.register([{
        id: script.id,
        matches: script.matches,
        js: [{ code: script.code }],
        runAt: 'document_idle',
        world: 'USER_SCRIPT'
      }]);
    } catch (error) {
      errors[script.id] = error.message;
    }
  }
  await setErrors(errors);
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install' && (await getScripts()).length === 0) {
    await setScripts(DEFAULT_SCRIPTS);
  }
  await syncScripts();
});

chrome.runtime.onStartup.addListener(syncScripts);

// Re-sincroniza ante cualquier cambio de la lista (popup u opciones).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEYS.SCRIPTS_KEY]) syncScripts();
});
