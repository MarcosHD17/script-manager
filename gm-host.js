// Lado background de la API GM_*: valida el permiso (@grant) de cada operación y la ejecuta.
import { getScripts, getGMValues, setGMValues } from './storage.js';

const OP_GRANT = {
  openInTab: 'GM_openInTab',
  setValue: 'GM_setValue',
  deleteValue: 'GM_deleteValue',
  xhr: 'GM_xmlhttpRequest'
};
const MAX_OPEN_PER_MINUTE = 100;
const openLog = new Map(); // scriptId -> marcas de tiempo (límite de aperturas)

// Escrituras de valores serializadas para evitar condiciones de carrera.
let valuesQueue = Promise.resolve();
function updateValues(scriptId, mutate) {
  valuesQueue = valuesQueue.then(async () => {
    const all = await getGMValues();
    all[scriptId] = all[scriptId] ?? {};
    mutate(all[scriptId]);
    await setGMValues(all);
  }).catch((error) => console.error('Error guardando valores GM:', error));
  return valuesQueue;
}

const assertHttp = (url) => {
  if (!/^https?:$/.test(new URL(url).protocol)) throw new Error('Solo se permiten URLs http(s)');
};

async function openInTab(message, sender) {
  assertHttp(message.url);
  const now = Date.now();
  const recent = (openLog.get(message.scriptId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= MAX_OPEN_PER_MINUTE) throw new Error('Límite de pestañas por minuto alcanzado');
  openLog.set(message.scriptId, [...recent, now]);
  await chrome.tabs.create({ url: message.url, active: !!message.active, openerTabId: sender.tab?.id });
  return { ok: true };
}

async function request(req) {
  assertHttp(req.url);
  const controller = new AbortController();
  const timer = req.timeout > 0 ? setTimeout(() => controller.abort(), req.timeout) : null;
  try {
    const method = String(req.method).toUpperCase();
    const response = await fetch(req.url, {
      method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : req.data,
      credentials: req.anonymous ? 'omit' : 'include',
      signal: controller.signal
    });
    return {
      status: response.status,
      statusText: response.statusText,
      responseText: await response.text(),
      finalUrl: response.url,
      responseHeaders: [...response.headers].map(([k, v]) => `${k}: ${v}`).join('\r\n')
    };
  } catch (error) {
    const timedOut = error.name === 'AbortError';
    return { status: 0, error: timedOut ? 'timeout' : error.message, timedOut };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function handle(message, sender) {
  const script = (await getScripts()).find((s) => s.id === message.scriptId);
  const grants = script?.grants ?? [];
  const needed = OP_GRANT[message.op];
  if (!needed || !(grants.includes('*') || grants.includes(needed))) {
    throw new Error(`Permiso no concedido: ${needed ?? message.op}`);
  }
  switch (message.op) {
    case 'openInTab': return openInTab(message, sender);
    case 'xhr': return request(message);
    case 'setValue': await updateValues(message.scriptId, (v) => { v[message.name] = message.value; }); return { ok: true };
    case 'deleteValue': await updateValues(message.scriptId, (v) => { delete v[message.name]; }); return { ok: true };
    default: throw new Error('Operación desconocida');
  }
}

// Debe llamarse de forma síncrona al arrancar el service worker.
export function registerGMHost() {
  chrome.runtime.onUserScriptMessage?.addListener((message, sender, sendResponse) => {
    if (message?.sm !== 1) return false;
    handle(message, sender).then(sendResponse, (error) => sendResponse({ error: error.message }));
    return true;
  });
}
