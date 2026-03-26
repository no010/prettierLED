# Changelog

## 0.1.1

### Changed

- Bumped package and extension metadata version for the next release.

## 0.1.0

### Added

- 🎉 Initial release: LED Symbol Generator
- Creates colored LED schematic symbols from input wavelengths
- Supports single- and multi-chip packages (stacked vertical layout)
- Optional common terminals: Common Anode / Common Cathode
- Generates schematic polygons and pins; pins snap to 50 mil grid
- Host ↔ IFrame messaging using LCEDA publish/subscribe (`LED_CREATE_SYMBOL`, `LED_CLOSE`)
- Cleans up previous primitives before redraw to avoid duplicates
- Developer docs and build scripts included

### Notes

- Internal geometry uses 1 unit = 10 mil. Default `PIN_LENGTH` = 150 mil (15 units).
- Use `npm run build` to produce the `.eext` package in `build/dist/`.
