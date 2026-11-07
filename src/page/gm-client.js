// API compatible con GM_* para scripts de usuario. Se serializa con toString() y corre en el
// mundo USER_SCRIPT: debe ser autocontenida. ctx = { id, name, version, grants, values }.
export function createGM(ctx) {
  const granted = (name) => ctx.grants.includes('*') || ctx.grants.includes(name);
  const values = { ...ctx.values };
  const call = (op, payload) => chrome.runtime.sendMessage({ sm: 1, scriptId: ctx.id, op, ...payload });
  const fire = (op, payload) => { call(op, payload).catch(() => {}); };
  const toJson = (text) => { try { return JSON.parse(text); } catch { return null; } };
  const gm = {
    GM_info: { script: { name: ctx.name }, scriptHandler: 'Script Manager', version: ctx.version }
  };

  if (granted('GM_log')) gm.GM_log = (...args) => console.log('[Script Manager]', ...args);

  if (granted('GM_addStyle')) {
    gm.GM_addStyle = (css) => {
      const style = document.createElement('style');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
      return style;
    };
  }

  if (granted('GM_openInTab')) {
    gm.GM_openInTab = (url, options) => {
      const opts = typeof options === 'boolean' ? { active: !options } : (options || {});
      fire('openInTab', { url: new URL(url, location.href).href, active: !!opts.active });
      return { close() {}, closed: false };
    };
  }

  if (granted('GM_setValue')) {
    gm.GM_setValue = (name, value) => {
      const clean = value === undefined ? null : JSON.parse(JSON.stringify(value));
      values[name] = clean;
      fire('setValue', { name, value: clean });
    };
  }
  if (granted('GM_getValue')) gm.GM_getValue = (name, fallback) => (name in values ? values[name] : fallback);
  if (granted('GM_deleteValue')) {
    gm.GM_deleteValue = (name) => { delete values[name]; fire('deleteValue', { name }); };
  }
  if (granted('GM_listValues')) gm.GM_listValues = () => Object.keys(values);

  if (granted('GM_xmlhttpRequest')) {
    gm.GM_xmlhttpRequest = (details) => {
      const request = {
        url: new URL(details.url, location.href).href,
        method: details.method || 'GET',
        headers: details.headers || {},
        data: details.data ?? null,
        anonymous: !!details.anonymous,
        timeout: details.timeout || 0
      };
      call('xhr', request).then((res) => {
        if (res?.timedOut) details.ontimeout?.(res);
        else if (!res || res.error) details.onerror?.({ status: 0, error: res?.error, responseText: '' });
        else details.onload?.({ ...res, response: details.responseType === 'json' ? toJson(res.responseText) : res.responseText });
        details.onloadend?.(res || {});
      }).catch((error) => {
        details.onerror?.({ status: 0, error: error.message, responseText: '' });
        details.onloadend?.({});
      });
      return { abort() {} };
    };
  }

  // Notificaciones flotantes propias (sin permiso extra): contenedor independiente por pestaña, inmune al dock.
  if (granted('GM_notification')) {
    gm.GM_notification = (a, b, c, d) => {
      const o = typeof a === 'object' && a ? { ...a } : { text: a, title: b, image: c, onclick: d };
      let hostEl = document.getElementById('__sm-toasts');
      if (!hostEl) {
        hostEl = document.createElement('div');
        hostEl.id = '__sm-toasts';
        hostEl.setAttribute('data-sm-ignore', '');
        hostEl.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;max-width:340px;pointer-events:none;font:13px system-ui,sans-serif';
        (document.body || document.documentElement).appendChild(hostEl);
      }
      const toast = document.createElement('div');
      toast.style.cssText = 'pointer-events:auto;background:#202124;color:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.35);cursor:pointer;white-space:pre-wrap;word-break:break-word';
      if (o.title) { const t = document.createElement('div'); t.style.fontWeight = '600'; t.textContent = o.title; toast.appendChild(t); }
      const body = document.createElement('div');
      body.textContent = o.text ?? o.body ?? '';
      toast.appendChild(body);
      const close = () => { if (toast.isConnected) { toast.remove(); o.ondone?.(); } };
      toast.addEventListener('click', () => { try { o.onclick?.(); } finally { close(); } });
      hostEl.appendChild(toast);
      setTimeout(close, o.timeout === 0 ? 0x7fffffff : (o.timeout || 5000));
      return { remove: close };
    };
  }

  if (granted('GM_setClipboard')) {
    gm.GM_setClipboard = (text) => { navigator.clipboard?.writeText(String(text)).catch(() => {}); };
  }
  const menu = new Map();
  if (granted('GM_registerMenuCommand')) {
    gm.GM_registerMenuCommand = (title, fn) => { const id = menu.size + 1; menu.set(id, { title, fn }); return id; };
  }
  if (granted('GM_unregisterMenuCommand')) gm.GM_unregisterMenuCommand = (id) => { menu.delete(id); };
  if (granted('GM_addElement')) {
    gm.GM_addElement = (a, b, c) => {
      const [parent, tag, attrs] = typeof a === 'string' ? [document.head || document.documentElement, a, b] : [a, b, c];
      const el = document.createElement(tag);
      Object.entries(attrs || {}).forEach(([k, v]) => (k === 'textContent' ? (el.textContent = v) : el.setAttribute(k, v)));
      parent.appendChild(el);
      return el;
    };
  }
  if (granted('GM_getResourceText')) gm.GM_getResourceText = () => null;
  if (granted('GM_getResourceURL')) gm.GM_getResourceURL = () => null;

  // API asíncrona GM.* (promesas) derivada de las GM_* concedidas; siempre disponible junto con unsafeWindow.
  const promised = (fn) => (...args) => new Promise((resolve) => resolve(fn(...args)));
  gm.GM = { info: gm.GM_info };
  for (const [key, name] of [['log', 'GM_log'], ['addStyle', 'GM_addStyle'], ['openInTab', 'GM_openInTab'], ['setValue', 'GM_setValue'],
    ['getValue', 'GM_getValue'], ['deleteValue', 'GM_deleteValue'], ['listValues', 'GM_listValues'], ['notification', 'GM_notification'],
    ['setClipboard', 'GM_setClipboard'], ['registerMenuCommand', 'GM_registerMenuCommand'], ['addElement', 'GM_addElement']]) {
    if (gm[name]) gm.GM[key] = promised(gm[name]);
  }
  if (gm.GM_xmlhttpRequest) gm.GM.xmlHttpRequest = (d) => new Promise((resolve, reject) => gm.GM_xmlhttpRequest({ ...d, onload: resolve, onerror: reject, ontimeout: reject }));
  gm.unsafeWindow = globalThis;
  return gm;
}

export const GM_NAMES = [
  'GM_info', 'GM_log', 'GM_addStyle', 'GM_openInTab', 'GM_setValue', 'GM_getValue',
  'GM_deleteValue', 'GM_listValues', 'GM_xmlhttpRequest', 'GM_notification', 'GM_setClipboard',
  'GM_registerMenuCommand', 'GM_unregisterMenuCommand', 'GM_addElement', 'GM_getResourceText', 'GM_getResourceURL',
  'GM', 'unsafeWindow'
];
