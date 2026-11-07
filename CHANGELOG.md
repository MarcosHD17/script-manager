# Registro de cambios

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
