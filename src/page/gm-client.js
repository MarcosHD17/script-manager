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
  return gm;
}

export const GM_NAMES = [
  'GM_info', 'GM_log', 'GM_addStyle', 'GM_openInTab', 'GM_setValue', 'GM_getValue',
  'GM_deleteValue', 'GM_listValues', 'GM_xmlhttpRequest'
];
