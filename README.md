# Script Manager (prueba)

Extensión Manifest V3 que inyecta múltiples scripts por página, activables de forma independiente.

## Arquitectura
- `background.js`: al completar la carga de una pestaña ejecuta los scripts activos cuyo patrón coincida (`tabs.onUpdated` + `userScripts.execute`, mundo `USER_SCRIPT`); atiende ejecución manual (`run` / `runAll`) y guarda el estado de cada ejecución.
- `storage.js`: acceso compartido a `chrome.storage.local` (`scripts`, `runStatus`).
- `popup.*`: interruptor por script (varios activos a la vez), botón ▶ por script y "Ejecutar todos los activos".
- `options.*`: CRUD de scripts (nombre, patrones de URL, código, estado), importar y exportar.
- `transfer.js`: validación y fusión de archivos importados.

## Instalación
1. `chrome://extensions` > activar modo desarrollador > "Cargar descomprimida".
2. Obligatorio: en Detalles de la extensión activar "Permitir scripts de usuario" (Chrome 135+). Sin él, el popup muestra una alerta y no se ejecuta nada.

## Modelo de datos
`{ id, name, matches: string[], code, enabled }`. Los patrones siguen el formato de match patterns de Chrome.

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
