# Registro de cambios

## 0.2.0
- fix: la inyección automática ya no depende de `userScripts.register`; usa `tabs.onUpdated` + `userScripts.execute` con coincidencia propia de match patterns.
- feat: botón ▶ por script y "Ejecutar todos los activos" en el popup (ejecución manual en la pestaña actual).
- feat: estado de la última ejecución por script (auto/manual, hora, error) visible en popup y opciones.
- chore: versión visible en el popup; se limpian registros persistentes de la v0.1.

## 0.1.0
- Base: popup, opciones, CRUD de scripts, múltiples scripts activos.
