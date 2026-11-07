// Implementación de match patterns de Chrome (esquema, host con comodín, ruta con comodín).
export function matchesUrl(pattern, url) {
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
