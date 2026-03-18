[简体中文](./README.md) | [English](./README.en.md)

# LED Symbol Generator

LED Symbol Generator — a schematic symbol extension for LCEDA Pro (formerly EasyEDA Pro).
It creates LED schematic symbols colored by wavelength and supports single- and multi-chip packages (e.g. RGB, bi-color), with optional common anode/cathode configurations.

## Features
- Computes visible color from wavelength and uses it to color symbol fills
- Supports stacked multi-chip layouts and optional common terminals (Common Anode / Common Cathode)
- Automatically creates pins with custom pin numbers and snaps pin positions to a 50 mil grid
- Geometry conventions: 1 unit = 10 mil; default pin length = 150 mil (15 units)
- Communicates with the host via LCEDA Pro's message bus (IFrame → Host publish/subscribe)
- Clears previous primitives before redraw to avoid leftover artifacts

## Installation (recommended)

1. Open LCEDA Pro
2. Extensions → Manage Extensions → Search for “LED Symbol Generator” and install

## Build from source (developers)

Requires Node.js >= 20.17.0

```bash
git clone https://github.com/no010/prettierLED.git
cd prettierLED
npm install
npm run build
# Packaged artifact located at build/dist/led-symbol-generator_v0.1.0.eext
```

## Usage

1. In the schematic symbol editor, open the menu: `LED Symbol Generator → Create LED Symbol...`.
2. In the dialog (IFrame): add one or more LED chips, provide wavelength (nm), A/K pin labels, and choose common terminal type if applicable.
3. Click Create — the IFrame publishes a `LED_CREATE_SYMBOL` message and the host draws polygons and pins into the current symbol document.

## Troubleshooting

- IFrame shows `undefined` or missing content: ensure `iframe/led-symbol.html` is included in the packaged `.eext` and that `openIFrame()` is called with a relative path without query strings (packager treats the path literal).
- No dialog / cannot open: verify `extension.json` contains the `symbol` header menu with `createLEDSymbol`, and `src/index.ts` exports `createLEDSymbol`.
- Duplicate creations: often caused by stale subscriptions in the host runtime — restart LCEDA to clear runtime or rely on host-side idempotency guards (the host code includes an `isHandlingCreate` guard).
- Messaging differences: LCEDA exposes queue-style (`pushPublic`/`pullPublic`) and broadcast-style (`publishPublic`/`subscribePublic`) APIs. The plugin defaults to broadcast-style; if your environment only supports queue APIs, adapt accordingly.

## Developer quick guide

```bash
npm install
npm run compile   # bundle to dist/
npm run build     # produce .eext in build/dist/
```

### Debug tips
- To quickly preview the IFrame UI, open `iframe/led-symbol.html` in a browser — note that host APIs (e.g. `sys_MessageBus`) are unavailable outside the extension environment.
- If subscriptions appear duplicated during development, restart LCEDA to clear previous runtime state.

## Contributing & License

Issues and pull requests are welcome. This project is licensed under Apache-2.0; see `LICENSE`.

Made with ❤️ for the LCEDA Pro community
