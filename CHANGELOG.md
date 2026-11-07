# Registro de cambios

## 0.9.0
- fix: el arrastre usaba el arrastre nativo del navegador (HTML5), que no respondía; se reemplaza por un arrastre propio con eventos de puntero: asa ⠿ visible, fantasma que sigue al cursor, línea azul que marca dónde caerá, resaltado del grupo destino, desplazamiento automático de la lista y Esc para cancelar. Funciona con ratón y táctil (desde el asa).
- feat: arrastrar uno de varios scripts seleccionados mueve toda la selección.
- feat: con un orden automático, soltar en una posición cambia a Manual conservando lo que se veía (y lo avisa); soltar sobre un grupo funciona siempre.
- feat: grupos más distinguibles: tarjeta con borde y cabecera del color del grupo (📁 + contador), scripts anidados con franja lateral del mismo color y "Sin grupo" en estilo neutro. Cada grupo recibe un color distinto automáticamente y se puede cambiar. También se ve en el popup.
- feat: agrupar en masa y de forma individual: casilla de selección por fila y por sección, Ctrl/Cmd+clic, Mayús+clic para rangos, "Seleccionar todos" y buscador por nombre o patrón; barra de acciones (mover a grupo, nuevo grupo con la selección, activar, desactivar, limpiar, eliminar). "+ Grupo" con scripts seleccionados los mueve al grupo nuevo.
- feat: interruptores de activación (fila y grupo) en lugar de casillas, para no confundirlos con la selección.
- feat: el color del grupo viaja en la exportación y la importación.

## 0.8.0
- feat: el contenedor flotante de las páginas sigue el tema elegido (Claro, Oscuro, Medianoche, Bosque, Sepia); "Automático" sigue el tema del sistema. El cambio llega a una página la próxima vez que se ejecuta un script en ella.
- chore: el ZIP de entrega incluye la versión en su nombre (`script-manager-vX.Y.Z.zip`).

## 0.7.0
- feat: grupos con nombre (crear, renombrar, eliminar, plegar, subir/bajar); casilla maestra para activar o desactivar todo un grupo, en opciones y popup.
- feat: orden de la lista: manual (flechas y arrastrar y soltar, también entre grupos), nombre A→Z / Z→A, modificados o creados recientemente, activos primero y con permisos de extensión primero. El orden elegido se aplica también en el popup.
- feat: control de versiones por script: cada guardado con cambios crea una versión (hasta 30) con nota opcional; comparar con el editor (diff línea a línea) y restaurar (se guarda como versión nueva); borrar versiones. Marca `vN` en la lista.
- feat: duplicar script (copia desactivada, en el mismo grupo, con su propio historial) y copiar como userscript al portapapeles (se puede pegar de vuelta en un script nuevo).
- feat: temas de las ventanas: Automático (sistema), Claro, Oscuro, Medianoche, Bosque y Sepia, en opciones y popup.
- feat: la exportación incluye el nombre del grupo y la importación recrea los grupos.
- refactor: nuevos módulos `organize.js`, `versions.js` y `theme.js`; `styles.css` basado en variables.
- chore: migración automática al abrir opciones (versión inicial y fechas para los scripts existentes). Eliminar un script borra su historial.

## 0.6.1
- feat: pegar un userscript completo en el editor aplica la cabecera (nombre, `@match`/`@include`, `@grant`) y, si el script es nuevo, lo guarda y lo deja activo sin más pasos.
- fix: se corrige automáticamente el patrón con esquema duplicado `*://*://*` → `*://*/*` (antes se descartaba y el script no corría en el segundo sitio); se informa de cada corrección.
- feat: aviso explícito si la cabecera no deja ningún patrón válido (el script no se guarda solo).
- feat: confirmación visible al guardar.

## 0.6.0
- feat: API de extensión compatible con Tampermonkey para los scripts: `GM_openInTab`, `GM_xmlhttpRequest` (sin CORS, vía background), `GM_setValue/getValue/deleteValue/listValues`, `GM_addStyle`, `GM_log`, `GM_info`.
- feat: permisos por script (`@grant`) en el editor; las funciones no concedidas quedan `undefined` (los `typeof GM_openInTab` de los userscripts siguen funcionando) y el background rechaza operaciones sin permiso.
- feat: "Leer cabecera ==UserScript==" aplica nombre, `@match`/`@include` válidos y `@grant`; descarta patrones inválidos.
- feat: importar archivos `.js` de userscript además de JSON.
- security: límite de 100 aperturas de pestaña por minuto y solo URLs http(s).
- chore: `configureWorld({ messaging: true })`; nuevos módulos `gm-client.js`, `gm-host.js`, `metadata.js`.

## 0.5.0
- feat: exportar todos los scripts o solo el seleccionado a JSON (`script-manager-AAAA-MM-DD.json`).
- feat: importar uno o varios archivos JSON; con ids repetidos se elige reemplazar o importar como copia. Se acepta también una lista simple de scripts.
- security: los scripts importados quedan desactivados hasta que el usuario los revise y active.
- refactor: nueva lógica pura en `transfer.js` (validación, normalización y fusión).

## 0.4.1
- fix: scripts que reutilizan el mismo id y limpian su botón anterior con `getElementById(...).remove()` se borraban entre sí antes de poder agruparse; ahora cada script solo ve los componentes creados por él (aislamiento en `getElementById`, solo en el mundo del script de usuario).

## 0.4.0
- feat: detección automática de componentes flotantes: los elementos `position:fixed` que un script añade directamente a `<body>`/`<html>` (appendChild, append, prepend, insertBefore, insertAdjacentElement) se montan solos en el contenedor, sin usar `ScriptManager.mount`.
- feat: ajuste "Detectar flotantes automáticamente" en el popup; exclusión por atributo `data-sm-ignore`; los overlays grandes (>60% de la ventana) se ignoran.
- feat: las tarjetas se limpian solas si el script elimina su componente; el título usa el nombre del script.
- fix: reejecutar un script reemplaza su componente en vez de duplicarlo.

## 0.3.0
- feat: API `ScriptManager.mount(elemento, { title, id })` disponible en cada script; con 2+ componentes los agrupa en un contenedor tipo lista (Shadow DOM) con plegar/cerrar por tarjeta y minimizar global. Con un solo componente se respeta su posición original.
- feat: ajuste "Agrupar flotantes en una lista" en el popup.
- refactor: cada script se ejecuta envuelto en una función (evita colisiones de `const` entre scripts); nuevo `runtime.js`.
- feat: ejemplos "componente flotante A/B" (en actualizaciones se añaden desactivados).

## 0.2.2
- refactor: se elimina el modo respaldo de 0.2.1; la extensión exige "Permitir scripts de usuario".
- feat: alerta visible en popup y opciones con botón para abrir los ajustes de la extensión; ▶ y "Ejecutar todos" se deshabilitan sin el permiso.
- chore: se retira el permiso `scripting`; `minimum_chrome_version` 135.

## 0.2.1
- fix: `chrome.userScripts` es `undefined` si el permiso "Permitir scripts de usuario" está desactivado (error `reading 'execute'`); ahora hay modo respaldo con `scripting.executeScript` (mundo MAIN) y detección de bloqueo por CSP.
- feat: el estado de ejecución indica el modo (`completo` / `respaldo`).
- chore: `minimum_chrome_version` 120; nuevo permiso `scripting`.

## 0.2.0
- fix: la inyección automática ya no depende de `userScripts.register`; usa `tabs.onUpdated` + `userScripts.execute` con coincidencia propia de match patterns.
- feat: botón ▶ por script y "Ejecutar todos los activos" en el popup (ejecución manual en la pestaña actual).
- feat: estado de la última ejecución por script (auto/manual, hora, error) visible en popup y opciones.
- chore: versión visible en el popup; se limpian registros persistentes de la v0.1.

## 0.1.0
- Base: popup, opciones, CRUD de scripts, múltiples scripts activos.
