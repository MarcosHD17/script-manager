import { getScripts, setScripts, getRunStatus, setRunStatus, getSettings, getGMValues, DEFAULT_SCRIPTS } from './storage.js';
import { bootstrap } from './runtime.js';
import { createGM, GM_NAMES } from './gm-client.js';
import { registerGMHost } from './gm-host.js';
import { matchesUrl } from './match.js';

registerGMHost(); // listener de mensajes GM_* (registro síncrono al arrancar)

// Comprueba que la API userScripts esté disponible y el permiso de usuario activado.
async function isAvailable() {
  try {
    await chrome.userScripts.getScripts();
    return typeof chrome.userScripts.execute === 'function';
  } catch {
    return false;
  }
}

// Escrituras de estado serializadas para evitar pisarse entre ejecuciones concurrentes.
let statusQueue = Promise.resolve();
function saveStatus(id, entry) {
  statusQueue = statusQueue.then(async () => {
    const all = await getRunStatus();
    all[id] = entry;
    await setRunStatus(all);
  }).catch((error) => console.error('Error guardando estado:', error));
  return statusQueue;
}

// El mundo USER_SCRIPT necesita messaging para hablar con el background (API GM_*).
let worldReady = false;
async function ensureWorld() {
  if (worldReady) return;
  await chrome.userScripts.configureWorld({ messaging: true });
  worldReady = true;
}

// Ejecuta en el mundo USER_SCRIPT (evita la CSP de la página). Cada script se envuelve en una función con su
// propio ScriptManager y las funciones GM_* concedidas (las no concedidas quedan undefined, como en Tampermonkey).
async function executeWithUserScripts(tabId, script, config) {
  const grants = script.grants ?? [];
  const gmContext = {
    id: script.id,
    name: script.name,
    version: config.version,
    grants,
    values: grants.length ? ((await getGMValues())[script.id] ?? {}) : {}
  };
  const params = GM_NAMES.join(', ');
  const args = GM_NAMES.map((name) => `gm.${name}`).join(', ');
  const id = JSON.stringify(script.id);
  const name = JSON.stringify(script.name);
  const js = [
    { code: `(${bootstrap.toString()})(${JSON.stringify(config)});` },
    { code: `(function () {\nconst sm = globalThis.__ScriptManager;\nsm.begin(${id}, ${name});\ntry {\nconst gm = (${createGM.toString()})(${JSON.stringify(gmContext)});\n(function (ScriptManager, ${params}) {\n${script.code}\n})(sm.forScript(${id}, ${name}), ${args});\n} finally { sm.end(); }\n})();` }
  ];
  await ensureWorld();
  const results = await chrome.userScripts.execute({ target: { tabId }, world: 'USER_SCRIPT', js });
  const failed = results?.find((r) => r.error);
  if (failed) throw new Error(String(failed.error));
}

// Ejecuta un script en una pestaña; exige el permiso "Permitir scripts de usuario".
async function runScript(tabId, script, trigger) {
  const entry = { ok: true, time: Date.now(), trigger };
  try {
    if (!(await isAvailable())) throw new Error('Falta el permiso "Permitir scripts de usuario"');
    const settings = await getSettings();
    await executeWithUserScripts(tabId, script, { dock: settings.dock, auto: settings.auto, theme: settings.theme, version: chrome.runtime.getManifest().version });
  } catch (error) {
    entry.ok = false;
    entry.error = error.message;
  }
  await saveStatus(script.id, entry);
  return entry;
}

// Ejecución automática: al terminar de cargar una pestaña, corre los scripts activos cuyo patrón coincida.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url || !(await isAvailable())) return;
  const scripts = (await getScripts()).filter(
    (s) => s.enabled && s.matches.some((pattern) => matchesUrl(pattern, tab.url))
  );
  for (const script of scripts) await runScript(tabId, script, 'auto');
});

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
