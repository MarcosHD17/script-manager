// Implementación de match patterns de Chrome (esquema, host con comodín, ruta con comodín).
// Acepta también las formas tolerantes de userscript (ver patterns.js), incluso si se guardaron sin normalizar.
// v0.17.0: motor tolerante — /path/* coincide con /path, /path/, /path/sub, /path?q=1;
//          host sin wildcard también acepta prefijo "www." por conveniencia del usuario.
import { normalizePattern } from './patterns.js';

/**
 * Construye un RegExp para la parte de ruta del patrón.
 *
 * Reglas:
 *  - "/*" o "/" o solo "*" → cualquier ruta (incluida raíz vacía)
 *  - "/base/*"             → /base, /base/, /base/sub, /base?q=1  (tolerante al slash final)
 *  - "/exact"              → /exact o /exact?q=1  (tolera query string)
 */
function buildPathRegex(path) {
  // Patrón comodín total
  if (!path || path === '/*' || path === '*' || path === '/') return /^.*$/;

  if (path.endsWith('/*')) {
    // /base/* → /base  /base/  /base/sub  /base?...
    const base = path.slice(0, -2); // quita el "/*" final
    const escaped = base.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped + '([/?].*)?$');
  }

  if (path.endsWith('/')) {
    // /base/ tratado igual que /base/* para mayor tolerancia
    const base = path.slice(0, -1);
    const escaped = base.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped + '([/?].*)?$');
  }

  // Ruta exacta: tolera query string pero no sub-rutas
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '([?].*)?$');
}

/**
 * Comprueba si el host del patrón coincide con el hostname/host de la URL.
 * Tolerancias añadidas en v0.17.0:
 *  - "example.com" también coincide con "www.example.com" (y viceversa).
 *  - "*.example.com" coincide con "example.com" (dominio raíz) y "sub.example.com".
 */
function hostMatches(patternHost, urlHostname, urlHost) {
  if (patternHost === '*') return true;
  const pH = patternHost.toLowerCase();
  const uN = urlHostname.toLowerCase();
  const uH = (urlHost || urlHostname).toLowerCase();

  // Coincidencia exacta (con o sin puerto)
  if (pH === uN || pH === uH) return true;

  // Wildcard de subdominio: *.example.com
  if (pH.startsWith('*.')) {
    const base = pH.slice(2);
    return uN === base || uN.endsWith('.' + base);
  }

  // Tolerancia www: "example.com" coincide con "www.example.com"
  if (uN === 'www.' + pH || pH === 'www.' + uN) return true;

  return false;
}

export function matchesUrl(rawPattern, url) {
  const pattern = normalizePattern(rawPattern);
  if (!pattern) return false;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  const proto = parsed.protocol.slice(0, -1); // "https", "http", "file", etc.

  if (pattern === '<all_urls>') return ['http', 'https', 'file', 'ftp'].includes(proto);

  // Descompone el patrón en: scheme://host/path
  // El path es opcional (si no hay "/" se trata como "/*")
  const m = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)?$/);
  if (!m) return false;
  const [, scheme, host, rawPath = '/*'] = m;

  // Verificar esquema
  const schemeOk = scheme === '*'
    ? ['http', 'https'].includes(proto)
    : scheme === proto;
  if (!schemeOk) return false;

  // Verificar host
  if (!hostMatches(host, parsed.hostname, parsed.host)) return false;

  // Verificar ruta (tolerante)
  const pathRegex = buildPathRegex(rawPath);
  return pathRegex.test(parsed.pathname + parsed.search);
}
