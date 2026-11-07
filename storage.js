// Capa de acceso a chrome.storage.local compartida por background, popup y opciones.
const SCRIPTS_KEY = 'scripts';
const RUN_STATUS_KEY = 'runStatus';
const SETTINGS_KEY = 'settings';

const DEMO_PANEL_CODE = (letter, color) =>
  "const box = document.createElement('div');\n" +
  "box.style.cssText = 'position:fixed;top:60px;right:20px;width:200px;padding:8px;background:" + color + ";border:1px solid #5f6368;border-radius:6px;font:12px sans-serif;z-index:2147483647';\n" +
  "box.textContent = 'Componente flotante " + letter + "';\n" +
  "ScriptManager.mount(box, { title: 'Demo " + letter + "' });";

export const DEFAULT_SCRIPTS = [
  { id: 'demo-panel-a', name: 'Demo: componente flotante A', matches: ['<all_urls>'], enabled: true, code: DEMO_PANEL_CODE('A', '#e8f0fe') },
  { id: 'demo-panel-b', name: 'Demo: componente flotante B', matches: ['<all_urls>'], enabled: true, code: DEMO_PANEL_CODE('B', '#fef7e0') },
  { id: 'demo-title', name: 'Demo: prefijo en el título', matches: ['<all_urls>'], enabled: false, code: "document.title = '[SM] ' + document.title;" }
];

export async function getScripts() {
  const data = await chrome.storage.local.get(SCRIPTS_KEY);
  return data[SCRIPTS_KEY] ?? [];
}

export async function setScripts(scripts) {
  await chrome.storage.local.set({ [SCRIPTS_KEY]: scripts });
}

// Estado de la última ejecución por script: { [id]: { ok, time, trigger, error? } }
export async function getRunStatus() {
  const data = await chrome.storage.local.get(RUN_STATUS_KEY);
  return data[RUN_STATUS_KEY] ?? {};
}

export async function setRunStatus(status) {
  await chrome.storage.local.set({ [RUN_STATUS_KEY]: status });
}

// Ajustes globales: dock = agrupar componentes flotantes en una lista cuando hay 2 o más.
export async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return { dock: true, ...(data[SETTINGS_KEY] ?? {}) };
}

export async function setSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export const STORAGE_KEYS = { SCRIPTS_KEY, RUN_STATUS_KEY, SETTINGS_KEY };
