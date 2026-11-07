# Script Manager (prueba)

Extensión Manifest V3 que inyecta múltiples scripts por página, activables de forma independiente.

## Arquitectura
Organizada por capas en `src/` (detalle y reglas de dependencia en `ARCHITECTURE.md`):
- `src/core/`: lógica pura sin `chrome.*` ni DOM (`organize/`, `transfer.js`, `versions.js`, `metadata.js`, `match.js`).
- `src/data/`: acceso a `chrome.storage.local` (`storage.js`), ejemplos (`defaults.js`) e importar/exportar (`io.js`).
- `src/page/`: código que se inyecta en las pestañas (`runtime.js`, `gm-client.js`).
- `src/background/`: service worker (`index.js` registra listeners; `executor.js`, `availability.js`, `status.js`, `gm-host.js`).
- `src/ui/shared/`: DOM y temas; `src/ui/popup/` y `src/ui/options/`: una responsabilidad por archivo.
- `pages/`: `popup.html` y `options.html`. `css/`: `theme.css`, `base.css`, `popup.css`, `options.css`.

## Instalación
1. `chrome://extensions` > activar modo desarrollador > "Cargar descomprimida".
2. Obligatorio: en Detalles de la extensión activar "Permitir scripts de usuario" (Chrome 135+). Sin él, el popup muestra una alerta y no se ejecuta nada.

## Modelo de datos
`{ id, name, matches: string[], code, enabled }`. Los patrones siguen el formato de match patterns de Chrome.

## Patrones de URL
Se aceptan match patterns de Chrome y formas tolerantes de userscript, que se normalizan al guardar o importar: `https://sitio.com/*`, `https://*.sitio.com/*`, `https://sitio.com*`, `sitio.com`, `http*://…`, `<all_urls>`. Varios patrones: uno por línea (o separados por comas). Un patrón sin arreglo no deja guardar. Los patrones no se versionan.

## Organización, versiones y temas
- **Eliminar grupos:** pregunta si se borra solo el grupo o el grupo con sus scripts. **Varios grupos:** casilla de la cabecera o Ctrl+clic; la barra de grupos fija, contrae, despliega o elimina; arrastrar uno seleccionado mueve todos. **⤒** lleva un script o grupo al principio. **Letra:** selector en Gestionar.
- **Grupos:** arrastra el asa ⠿ del grupo para moverlo (Gestionar y popup). 📌 fija un grupo arriba. "Contraer todo / Desplegar todo" actúa sobre todos los grupos y "Sin grupo", que también se puede plegar. En Gestionar el panel superior queda fijo y solo la lista se desplaza.
- **Importar / exportar desde el popup:** botones "⬇ Exportar" y "⬆ Importar" (si el selector de archivos cierra el popup en tu Chrome, usa Gestionar).
- **Desde el popup:** "+ Nuevo" crea un script (nombre, patrón —por defecto el origen de la pestaña— y código); ✎ lo abre en Gestionar; el asa ⠿ permite ordenarlo o moverlo a otro grupo (Esc cancela). Cada fila indica si el script se cargará automáticamente en la pestaña actual (activo **y** con patrón coincidente).
- **Ordenar arrastrando:** toma una fila (asa ⠿ o cualquier parte que no sea un control) y suéltala donde quieras; la línea azul marca el lugar. Soltarla sobre la cabecera de un grupo la agrupa; sobre otra fila, la agrupa y la ordena. Esc cancela. Si arrastras uno de varios seleccionados, se mueve toda la selección. 
- **Grupos:** "+ Grupo" crea uno (si hay scripts seleccionados, los mueve a él). Cada grupo es una tarjeta con su color (cámbialo con el círculo de color), con los scripts anidados bajo una franja del mismo color. Se pueden plegar, renombrar, eliminar, fijar, llevar al principio y arrastrar. El interruptor del grupo activa o desactiva toda su sección.
- **Agrupar en masa:** marca scripts con la casilla de cada fila, Ctrl/Cmd+clic, Mayús+clic (rango), la casilla de una cabecera (toda la sección) o "Seleccionar todos" (solo los visibles; combínalo con el buscador). La barra superior permite moverlos a un grupo, crear un grupo nuevo con ellos, activarlos, desactivarlos, limpiar o eliminar.
- **Orden:** selector "Ordenar" (manual, nombre, fechas, activos, con permisos). Con un orden automático, soltar en una posición cambia a Manual conservando lo que veías.
- **Versiones:** cada guardado con cambios crea una versión (máx. 30 por script, con nota opcional). En "Historial de versiones": Comparar con el editor, Restaurar (crea una versión nueva) y borrar.
- **Duplicar / Copiar:** "Duplicar" crea una copia desactivada del script guardado; "Copiar" deja en el portapapeles un userscript con cabecera que se puede pegar en un script nuevo.
- **Tema:** selector "Tema" (Automático, Claro, Oscuro, Medianoche, Bosque, Sepia); se aplica a opciones, popup y al contenedor flotante de las páginas (este último se actualiza al ejecutar un script en la página).

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
`{ "format": "script-manager", "formatVersion": 2, "scripts": [{ id, name, matches, grants, code, enabled, groupName?, groupColor?, history?: [{ rev, at, note, name, matches, grants, code }] }] }`. El historial de versiones viaja en la exportación (el formato 1 sin historial también se importa).
Los scripts importados conservan su estado (los `.js` de userscript quedan activos); con ids repetidos se elige reemplazar o crear copia.

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
