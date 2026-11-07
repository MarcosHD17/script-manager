# Script Manager (prueba)

Extensión Manifest V3 que inyecta múltiples scripts por página, activables de forma independiente.

## Arquitectura
- `background.js`: al completar la carga de una pestaña ejecuta los scripts activos cuyo patrón coincida (`tabs.onUpdated` + `userScripts.execute`, mundo `USER_SCRIPT`); atiende ejecución manual (`run` / `runAll`) y guarda el estado de cada ejecución.
- `storage.js`: acceso compartido a `chrome.storage.local` (`scripts`, `runStatus`).
- `popup.*`: interruptor por script (varios activos a la vez), botón ▶ por script y "Ejecutar todos los activos".
- `options.*`: CRUD de scripts (nombre, patrones de URL, código, estado), importar y exportar.
- `transfer.js`: validación y fusión de archivos importados.
- `organize.js`: orden, grupos, movimientos y duplicado (lógica pura).
- `versions.js`: historial de versiones y diff (lógica pura).
- `theme.js`: temas de las ventanas.
- `metadata.js`: lectura de cabeceras ==UserScript==.
- `gm-client.js` / `gm-host.js`: API GM_* (lado script y lado background).

## Instalación
1. `chrome://extensions` > activar modo desarrollador > "Cargar descomprimida".
2. Obligatorio: en Detalles de la extensión activar "Permitir scripts de usuario" (Chrome 135+). Sin él, el popup muestra una alerta y no se ejecuta nada.

## Modelo de datos
`{ id, name, matches: string[], code, enabled }`. Los patrones siguen el formato de match patterns de Chrome.

## Organización, versiones y temas
- **Grupos:** "+ Grupo" en opciones. Arrastra scripts a un grupo o elígelo en el editor. La casilla del grupo activa/desactiva todos sus scripts.
- **Orden:** selector "Ordenar". En modo Manual se usan las flechas ▲▼ o arrastrar y soltar; en los demás modos el orden es automático dentro de cada grupo.
- **Versiones:** cada guardado con cambios crea una versión (máx. 30 por script, con nota opcional). En "Historial de versiones": Comparar con el editor, Restaurar (crea una versión nueva) y borrar.
- **Duplicar / Copiar:** "Duplicar" crea una copia desactivada del script guardado; "Copiar" deja en el portapapeles un userscript con cabecera que se puede pegar en un script nuevo.
- **Tema:** selector "Tema" (Automático, Claro, Oscuro, Medianoche, Bosque, Sepia); se aplica a opciones y popup.

## API de extensión (GM_*)
Los scripts pueden usar funciones con privilegios de extensión si se les concede en "Permisos de extensión (@grant)" (o con `*`):
`GM_openInTab`, `GM_xmlhttpRequest`, `GM_setValue`, `GM_getValue`, `GM_deleteValue`, `GM_listValues`, `GM_addStyle`, `GM_log` y `GM_info` (siempre disponible).
- Las funciones no concedidas quedan `undefined`; el background valida el permiso en cada llamada.
- `GM_getValue` es síncrono (lee una copia tomada al ejecutar); `GM_setValue` persiste en segundo plano.
- No hay `unsafeWindow`: el script corre en un mundo aislado y no ve las variables JS de la página.
- Pegar un userscript completo en el editor aplica la cabecera automáticamente y, si el script es nuevo, lo guarda activo. El patrón con esquema duplicado `*://*://*` se corrige a `*://*/*`.
- "Leer cabecera ==UserScript==" aplica `@name`, `@match`/`@include` válidos y `@grant`. También se pueden importar archivos `.js`.

## Importar / exportar
En la página de opciones: "Exportar todos", "Exportar este" e "Importar" (JSON). Formato:
`{ "format": "script-manager", "formatVersion": 1, "scripts": [{ id, name, matches, code, enabled }] }`.
Los scripts importados quedan desactivados; con ids repetidos se elige reemplazar o crear copia.

## API para componentes flotantes
```js
const box = document.createElement('div');
box.textContent = 'Mi panel';
const handle = ScriptManager.mount(box, { title: 'Mi panel', id: 'main' });
// handle.remove(); handle.setTitle('Otro título');
```
- Con 2+ componentes montados se agrupan en un contenedor tipo lista; con uno solo conserva su posición.
- Detección automática (ajuste del popup): los elementos `position:fixed` que un script añade directo a `<body>`/`<html>` se agrupan sin llamar a `mount`. Excluir con `data-sm-ignore`. Se ignoran overlays mayores al 60% de la ventana.
- `document.getElementById` oculta, durante la ejecución síncrona de un script, los componentes que creó otro script (evita que se borren entre sí si comparten id).
- Los parches DOM viven solo en el mundo del script de usuario; no alteran los scripts de la página.
- No se detectan elementos anidados dentro de otros contenedores ni los que cambian a `fixed` después de insertarse.
- Cada script corre en su propia función: sus variables no chocan con las de otros scripts.

## Versionado
Versión en `manifest.json` (SemVer) y historial en `CHANGELOG.md`. Incrementar `version` en cada entrega; se muestra en el popup.
