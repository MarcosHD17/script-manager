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
async function doSync() {
  if (!(await isUserScriptsAvailable())) return { available: false, registered: 0 };

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
  return { available: true, registered: (await chrome.userScripts.getScripts()).length };
}

// Cola serial: evita condiciones de carrera ("Duplicate script ID") entre sincronizaciones concurrentes.
let syncQueue = Promise.resolve();
function syncScripts() {
  const run = syncQueue.then(doSync);
  syncQueue = run.catch((error) => console.error('Error de sincronización:', error));
  return run;
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install' && (await getScripts()).length === 0) {
    await setScripts(DEFAULT_SCRIPTS);
  }
  await syncScripts();
});

chrome.runtime.onStartup.addListener(syncScripts);

// Re-sincroniza ante cambios de la lista (popup u opciones).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEYS.SCRIPTS_KEY]) syncScripts();
});

// Permite forzar la sincronización desde la UI (p. ej. tras activar "Permitir scripts de usuario").
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'sync') return false;
  syncScripts().then(sendResponse, (error) => sendResponse({ available: false, registered: 0, error: error.message }));
  return true;
});

// Sincroniza en cada arranque del service worker.
syncScripts();
