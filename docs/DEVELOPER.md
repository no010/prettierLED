# Developer Guide — LED Symbol Generator

This document describes how to build, package, and debug the LED Symbol Generator extension.

Requirements
- Node.js >= 20.17.0
- npm (comes with Node.js)

Repository layout (relevant files)
- `extension.json` — extension manifest (menus, entry)
- `package.json` — build scripts
- `src/index.ts` — extension entry points
- `src/ui/led-symbol-generator.ts` — host message-bus handlers and IFrame lifecycle
- `src/core/led-symbol-builder.ts` — geometry, drawing, primitives
- `iframe/led-symbol.html` — IFrame UI and publish logic

Build & Package

Commands

```bash
# Install dependencies
npm install

# Bundle TypeScript into dist/ (esbuild via ts-node config)
npm run compile

# Build release package (.eext) → build/dist/
npm run build
```

Notes
- `npm run compile` executes the esbuild bundling configured in `config/esbuild.prod.ts` and outputs `dist/` files.
- `npm run build` runs `npm run compile` then executes `build/packaged.ts` to create the `.eext` package in `build/dist/`.
- The `.eext` file is a ZIP-like archive — ensure `iframe/led-symbol.html` is included in the package. The packager treats file paths literally; avoid adding query strings to `openIFrame()` URLs.

Message bus design (Host ↔ IFrame)

LCEDA Pro offers both queue-based (push/pull) and broadcast-based (publish/subscribe) message APIs. The extension uses broadcast-style by default.

Host (example): subscribe and handle create requests

```ts
const bus = eda.sys_MessageBus;
// Prefer subscribePublic if available (returns unsubscribe handle)
const unsub = bus.subscribePublic?.('LED_CREATE_SYMBOL', async (payload) => {
	// Guard to prevent duplicate processing
	if (globalThis.__LED_RUNTIME__?.isHandlingCreate)
		return;
	globalThis.__LED_RUNTIME__ = globalThis.__LED_RUNTIME__ || {};
	globalThis.__LED_RUNTIME__.isHandlingCreate = true;
	try {
		// validate payload and call drawing functions in src/core/led-symbol-builder
	}
	finally {
		globalThis.__LED_RUNTIME__.isHandlingCreate = false;
	}
});
```

IFrame (example): publish create requests

```js
function pushCreate(payload) {
	const bus = window.parent?.eda?.sys_MessageBus;
	if (!bus)
		throw new Error('MessageBus unavailable');
	if (typeof bus.publishPublic === 'function')
		bus.publishPublic('LED_CREATE_SYMBOL', payload);
	else if (typeof bus.pushPublic === 'function')
		bus.pushPublic('LED_CREATE_SYMBOL', payload);
	else throw new Error('No suitable message bus method');
}
```

Debugging
- Inspect logs: use `eda.sys_Log.add()` in both host and IFrame to surface useful messages into LCEDA logs.
- If the IFrame shows `undefined` or fails to load assets, unzip the `.eext` file and verify `iframe/led-symbol.html` exists.
- If duplicate create events occur during development, restart LCEDA to clear in-memory subscriptions.

Packaging verification (PowerShell example)

```powershell
# After build
Get-Item build\dist\led-symbol-generator_v0.1.1.eext | Select-Object Name, LastWriteTime
# To inspect archive contents
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::OpenRead('build\dist\led-symbol-generator_v0.1.1.eext').Entries | Select-Object FullName
```

Conventions and geometry
- 1 unit = 10 mil.
- `TRIANGLE_WIDTH`, `TRIANGLE_HEIGHT`, `PIN_LENGTH`, and `LED_SPACING` are defined in `src/core/led-symbol-builder.ts`.
- The code snaps pin Y positions to multiples of 5 units (50 mil grid) to ensure consistent wiring alignment.

Releasing
- Bump `version` in `extension.json` and `package.json` following SemVer.
- Run `npm run build` and validate the produced `.eext` in `build/dist/`.

Appendix: common host API helpers
- `eda.sch_PrimitivePolygon.create(points, strokeColor, fillColor, lineWidth, primitiveLock)` — create polygon
- `eda.sch_PrimitivePin.create(x, y, pinNumber, pinLabel, rotation, pinLength, primitiveLock)` — create pin
- `eda.sch_PrimitivePolygon.getAllPrimitiveId()` / `eda.sch_PrimitivePin.getAllPrimitiveId()` — get IDs for cleanup

If you want, I can add a small host-side example file showing the exact subscribe/cleanup pattern used in this repo.
