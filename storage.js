// Capa de acceso a chrome.storage.local compartida por background, popup y opciones.
const SCRIPTS_KEY = 'scripts';
const ERRORS_KEY = 'syncErrors';

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

export async function getErrors() {
  const data = await chrome.storage.local.get(ERRORS_KEY);
  return data[ERRORS_KEY] ?? {};
}

export async function setErrors(errors) {
  await chrome.storage.local.set({ [ERRORS_KEY]: errors });
}

export const STORAGE_KEYS = { SCRIPTS_KEY, ERRORS_KEY };
