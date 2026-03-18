/**
 * Entry point for LED Symbol Generator extension
 *
 * This extension creates LED schematic symbols based on dominant wavelength,
 * supporting multi-chip LED packages (RGB LED, bi-color LED, etc.)
 */

/**
 * Extension activation function
 * Called when the extension is loaded
 */
// eslint-disable-next-line unused-imports/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {
	// Activation logic handled by menu registration
}

/**
 * Create LED Symbol
 * Opens the LED symbol generator dialog
 * This function is registered in extension.json headerMenus
 */
export { createLEDSymbol } from './ui/led-symbol-generator';