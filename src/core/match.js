// Implementación de match patterns de Chrome (esquema, host con comodín, ruta con comodín).
// Acepta también las formas tolerantes de userscript (ver patterns.js), incluso si se guardaron sin normalizar.
import { normalizePattern } from './patterns.js';

export function matchesUrl(rawPattern, url) {
  const pattern = normalizePattern(rawPattern);
  if (!pattern) return false;
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
    } else if ((host.includes(':') ? parsed.host : parsed.hostname) !== host) {
      return false;
    }
  }
  const regex = new RegExp('^' + path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return regex.test(parsed.pathname + parsed.search);
}
