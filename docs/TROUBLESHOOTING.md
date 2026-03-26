# Troubleshooting & Examples — LED Symbol Generator

This document lists common problems, their causes, and steps to debug or fix them.

1) IFrame shows `undefined` or blank
- Cause: packager may not have included `iframe/led-symbol.html` in the `.eext`, or `openIFrame()` was called with a URL that includes a query string (packager treats paths literally).
- Check:
  - Open the package `build/dist/led-symbol-generator_v0.1.1.eext` (it's a ZIP archive) and verify `iframe/led-symbol.html` exists.
  - Ensure host calls `eda.sys_IFrame.openIFrame('/iframe/led-symbol.html', ...)` without appended query strings.
- Fix: Rebuild (`npm run build`) and reinstall the `.eext`.

2) Clicking menu does nothing / no popup
- Cause: `extension.json` header menu misconfigured, or `createLEDSymbol` not exported from the built `dist/index.js`.
- Check:
  - Verify `extension.json` contains the `symbol` header menu and menu item id `createLEDSymbol`.
  - Confirm `dist/index.js` (or `dist/index.ts` before packaging) exports `createLEDSymbol`.
- Fix: Update manifest or export and rebuild.

3) Duplicate symbols or double creation
- Cause: duplicate subscriptions in host runtime (hot reloads, stale runtime) or queue-mode listeners producing duplicate processing.
- Check:
  - Look at LCEDA logs for repeated `create LED symbol` entries with similar timestamps.
  - Confirm host subscrption code uses `subscribePublic` (which can return an unsubscribe) instead of queue `pullPublic` in non-queue scenarios.
- Fix:
  - Restart LCEDA to clear runtime subscriptions.
  - Ensure host code sets a guard, e.g. `globalThis.__LED_RUNTIME__.isHandlingCreate`.

4) Pins not aligned / wrong spacing
- Cause: geometry constants or grid snap mismatch.
- Check:
  - Inspect `src/core/led-symbol-builder.ts` and confirm `GEOMETRY` values:
    - `TRIANGLE_WIDTH`, `TRIANGLE_HEIGHT`, `PIN_LENGTH`, `LED_SPACING`, `GRID`.
  - Confirm `snapToGrid()` uses `GRID = 5` (i.e., 50 mil) and step equals `TRIANGLE_HEIGHT + LED_SPACING` aligns to 10-unit multiples.
- Fix: adjust `GEOMETRY.LED_SPACING` or `TRIANGLE_HEIGHT` to meet desired step alignment, then rebuild.

5) Message is sent but host does not act
- Cause: message-bus mismatch (push/pull vs publish/subscribe) or topic name mismatch.
- Check:
  - IFrame publishes `LED_CREATE_SYMBOL` (see network log or add `eda.sys_Log.add()` in IFrame before publishing).
  - Host is subscribing to the exact same topic and has appropriate method (`subscribePublic`/`pullPublic` depending on environment).
- Fix: adapt IFrame to use `pushPublic` when only queue API is available, and implement request-response correlation if necessary.

6) Visual artifacts remain after redraw
- Cause: cleanup function failed to remove prior primitives, or deletion calls were partial.
- Check:
  - Host should call `eda.sch_PrimitivePolygon.getAllPrimitiveId()` and `eda.sch_PrimitivePin.getAllPrimitiveId()` and delete returned IDs.
  - Inspect LCEDA logs for any errors thrown while deleting primitives.
- Fix: Ensure deletion awaits the promises and check returned IDs before calling delete.

Collecting diagnostics
- Ask user to provide:
  - A screenshot of the created symbol in the schematic editor.
  - The LCEDA runtime log entries during the create operation (search for `[LED]` or `[LED][Iframe]` prefixes).
  - The produced `.eext` package (or at least confirm `iframe/led-symbol.html` exists inside it).

Quick checklist for a failed create
1. Rebuild and re-install .eext: `npm run build` → install the produced `.eext` in LCEDA extension manager.
2. Restart LCEDA to clear stale runtime subscriptions.
3. Open the IFrame and ensure `LED_CREATE_SYMBOL` publish is logged (add `eda.sys_Log.add()` in IFrame if needed).
4. Check host console/logs for errors and for successful polygon/pin creation messages.

Example log lines to look for
- `[LED][Iframe] create LED symbol | name=LED_RGB | chips=3`
- `[LED] handleCreateSymbol start` / `done` / `ignore stale create request`

If you give me a screenshot or the LCEDA logs from a failing run, I can point to the exact location in the codebase to adjust.
