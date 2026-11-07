// Capa de acceso a chrome.storage.local compartida por background, popup y opciones.
const SCRIPTS_KEY = 'scripts';
const RUN_STATUS_KEY = 'runStatus';
const SETTINGS_KEY = 'settings';
const GM_VALUES_KEY = 'gmValues';
const GROUPS_KEY = 'groups';
const HISTORY_KEY = 'history';

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

// Grupos de scripts: [{ id, name, collapsed }] (el orden del arreglo es el orden de los grupos)
export async function getGroups() {
  const data = await chrome.storage.local.get(GROUPS_KEY);
  return data[GROUPS_KEY] ?? [];
}

export async function setGroups(groups) {
  await chrome.storage.local.set({ [GROUPS_KEY]: groups });
}

// Historial de versiones: { [scriptId]: Version[] } (ver versions.js)
export async function getHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return data[HISTORY_KEY] ?? {};
}

export async function setHistory(history) {
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

// Valores persistentes de GM_setValue/GM_getValue: { [scriptId]: { [clave]: valor } }
export async function getGMValues() {
  const data = await chrome.storage.local.get(GM_VALUES_KEY);
  return data[GM_VALUES_KEY] ?? {};
}

export async function setGMValues(values) {
  await chrome.storage.local.set({ [GM_VALUES_KEY]: values });
}

// Ajustes globales: ungroupedCollapsed = "Sin grupo" plegado; dock = agrupar flotantes (2+, experimental); auto = detectar flotantes sin mount() (experimental); floatingV2 = migración hecha; sort = orden de la lista; theme = tema de las ventanas.
export async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = data[SETTINGS_KEY] ?? {};
  // Migración: antes dock/auto venían activados por defecto y podían congelar páginas con 2+ scripts; se desactivan una vez.
  const legacy = stored.floatingV2 ? {} : { dock: false, auto: false };
  return { dock: false, auto: false, sort: 'manual', theme: 'auto', ungroupedCollapsed: false, fontSize: 13, ...stored, ...legacy };
}

export async function setSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...settings, floatingV2: true } });
}

export const STORAGE_KEYS = { SCRIPTS_KEY, RUN_STATUS_KEY, SETTINGS_KEY };
