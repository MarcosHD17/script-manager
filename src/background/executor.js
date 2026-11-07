// Ejecución de scripts en una pestaña.
import { getSettings, getGMValues } from '../data/storage.js';
import { bootstrap } from '../page/runtime.js';
import { createGM, GM_NAMES } from '../page/gm-client.js';
import { isAvailable, ensureWorld } from './availability.js';
import { saveStatus } from './status.js';

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
export async function runScript(tabId, script, trigger) {
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
