// Capa de acceso a chrome.storage.local compartida por background, popup y opciones.
const SCRIPTS_KEY = 'scripts';
const RUN_STATUS_KEY = 'runStatus';

export const DEFAULT_SCRIPTS = [
  {
    id: 'demo-banner',
    name: 'Demo: banner superior',
    matches: ['<all_urls>'],
    enabled: true,
    code: "const bar = document.createElement('div');\nbar.textContent = 'Script Manager: demo-banner activo';\nbar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#1a73e8;color:#fff;font:12px sans-serif;padding:4px;text-align:center';\ndocument.documentElement.appendChild(bar);"
  },
  {
    id: 'demo-title',
    name: 'Demo: prefijo en el título',
    matches: ['<all_urls>'],
    enabled: false,
    code: "document.title = '[SM] ' + document.title;"
  }
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

export const STORAGE_KEYS = { SCRIPTS_KEY, RUN_STATUS_KEY };
