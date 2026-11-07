import { getScripts, setScripts, getRunStatus, setRunStatus, getSettings, DEFAULT_SCRIPTS } from './storage.js';
import { bootstrap } from './runtime.js';

// Comprueba que la API userScripts esté disponible y el permiso de usuario activado.
async function isAvailable() {
  try {
    await chrome.userScripts.getScripts();
    return typeof chrome.userScripts.execute === 'function';
  } catch {
    return false;
  }
}

// Implementación de match patterns de Chrome (esquema, host con comodín, ruta con comodín).
function matchesUrl(pattern, url) {
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  const proto = parsed.protocol.slice(0, -1);
  if (pattern === '<all_urls>') return ['http', 'https', 'file', 'ftp'].includes(proto);

  const m = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)$/);
  if (!m) return false;
  const [, scheme, host, path] = m;
  if (scheme === '*' ? !['http', 'https'].includes(proto) : scheme !== proto) return false;
  if (host !== '*') {
    if (host.startsWith('*.')) {
      const base = host.slice(2);
      if (parsed.hostname !== base && !parsed.hostname.endsWith('.' + base)) return false;
    } else if (parsed.hostname !== host) {
      return false;
    }
  }
  const regex = new RegExp('^' + path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return regex.test(parsed.pathname + parsed.search);
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

// Ejecuta en el mundo USER_SCRIPT (evita la CSP de la página). Cada script se envuelve en una función
// con su propio ScriptManager, lo que además evita colisiones de variables entre scripts.
async function executeWithUserScripts(tabId, script, config) {
  const js = [
    { code: `(${bootstrap.toString()})(${JSON.stringify(config)});` },
    { code: `(function () {\nconst sm = globalThis.__ScriptManager;\nsm.begin(${JSON.stringify(script.id)}, ${JSON.stringify(script.name)});\ntry {\n(function (ScriptManager) {\n${script.code}\n})(sm.forScript(${JSON.stringify(script.id)}, ${JSON.stringify(script.name)}));\n} finally { sm.end(); }\n})();` }
  ];
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
    await executeWithUserScripts(tabId, script, { dock: settings.dock, auto: settings.auto, version: chrome.runtime.getManifest().version });
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
