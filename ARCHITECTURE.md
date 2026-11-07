# Arquitectura

## Estructura
```
manifest.json
pages/        popup.html, options.html
css/          theme.css (variables), base.css (elementos comunes), popup.css, options.css
src/
  core/       lógica pura (sin chrome.* ni DOM)
    organize/   sorting.js · groups.js · moves.js · scripts.js · index.js (reexporta)
    transfer.js versions.js metadata.js match.js
  data/       storage.js (chrome.storage.local) · defaults.js · io.js (importar/exportar)
  page/       runtime.js · gm-client.js   (se serializan e inyectan en la pestaña)
  background/ index.js · availability.js · status.js · executor.js · gm-host.js
    listeners/  auto-run.js · messages.js · install.js
  ui/
    shared/     dom.js · theme.js
    popup/      index.js · state.js · dom.js · status.js · controls.js · actions.js
                list.js · drag.js · tools.js · new-form.js · settings.js
    options/    index.js · state.js · dom.js · editor-form.js · editor.js · history.js
                list.js · group-header.js · script-row.js · controls.js · bulk.js
                group-actions.js · drag.js · transfer-ui.js · appearance.js · availability.js
```

## Reglas de dependencia
`ui` y `background` → `data` y `core`; `data` → `core`; `core` no importa nada fuera de `core`.
`page/` es autocontenido: sus funciones se convierten con `toString()` y se inyectan, así que no pueden importar nada ni usar variables externas.

## Flujos
- **Ejecución:** `listeners/auto-run.js` (pestaña cargada) o `listeners/messages.js` (popup: `run`/`runAll`) → `executor.runScript` → `userScripts.execute` con `page/runtime.js` + `page/gm-client.js`.
- **Estado:** todo vive en `chrome.storage.local` (`scripts`, `groups`, `history`, `settings`, `runStatus`, `gmValues`). Las UI se repintan con `chrome.storage.onChanged`.
- **Importar/exportar:** `data/io.js` (compartido por popup y opciones) usa `core/transfer.js` (formato 2, con historial).

## Opciones: cómo se conectan los módulos
Para evitar importaciones circulares, los módulos llaman a `hooks.renderList()`, `hooks.select()` y `hooks.clearEditor()` (`options/state.js`); `options/index.js` los enlaza al arrancar. Estado compartido: `state`, `selected`, `selectedGroups`.

## Añadir una función
1. Lógica de datos/orden → `core/` (con pruebas sin navegador).
2. Persistencia → `data/storage.js`.
3. UI → un módulo nuevo en `ui/popup/` o `ui/options/` y su registro en `index.js`.
4. Actualizar `README.md`, `CHANGELOG.md` y esta guía.
