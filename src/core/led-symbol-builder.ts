/**
 * LED Symbol Builder Module
 *
 * Creates LED schematic symbols with geometry calculations and drawing primitives
 * Supports single and multi-chip LED packages (e.g., RGB LED, bi-color LED)
 */

import type { RGBColor } from './wavelength-to-color';
import { getColorName, getColorNameZh, wavelengthToRGB } from './wavelength-to-color';

/**
 * Represents a single LED chip in a multi-chip package
 */
export interface LEDChip {
	/** Dominant wavelength in nm (380-780) */
	wavelength: number;
	/** Anode pin number/label */
	anodePinNumber: string;
	/** Cathode pin number/label */
	cathodePinNumber: string;
	/** Calculated RGB color from wavelength */
	color: RGBColor;
	/** Color name for display */
	colorName: string;
}

/**
 * Common terminal configuration for multi-chip LEDs
 */
export type CommonTerminalType = 'none' | 'commonCathode' | 'commonAnode';

/**
 * Options for creating an LED symbol
 */
export interface LEDSymbolOptions {
	/** Symbol name (e.g., "LED_RGB_5050") */
	symbolName: string;
	/** List of LED chips (supports multi-chip packages) */
	ledChips: LEDChip[];
	/** Common terminal type */
	commonTerminalType: CommonTerminalType;
	/** Common terminal pin number (required if commonTerminalType is not 'none') */
	commonTerminalPin?: string;
	/** Target library UUID */
	libraryUuid: string;
	/** Symbol description */
	description?: string;
}

/**
 * Geometry constants for LED symbol
 * Unit: 10 mil (1 unit = 10 mil)
 * e.g. PIN_LENGTH = 10 = 100 mil, TRIANGLE_WIDTH = 10 = 100 mil
 *
 * Grid alignment rule: pin Y positions must be multiples of 5 units (50 mil).
 * For step = TRIANGLE_HEIGHT + LED_SPACING to satisfy this:
 *   step must be a multiple of 10 units (100 mil).
 *   8 + 12 = 20 ✓  →  pins land at multiples of 100 mil (always on 50 mil grid)
 */
const GEOMETRY = {
	/** Triangle width along horizontal direction (100 mil) */
	TRIANGLE_WIDTH: 10,
	/** Triangle height along vertical direction (80 mil) */
	TRIANGLE_HEIGHT: 8,
	/** Pin length (150 mil) */
	PIN_LENGTH: 15,
	/** Line width for drawing */
	LINE_WIDTH: 1,
	/** Spacing between stacked LEDs (120 mil). step = 8+12 = 20 = 200 mil = 4×50 mil) */
	LED_SPACING: 12,
	/** Grid snap size (50 mil) */
	GRID: 5,
} as const;

/** Snap value to nearest grid multiple */
function snapToGrid(value: number, grid = GEOMETRY.GRID): number {
	return Math.round(value / grid) * grid;
}

/**
 * Create LED chip from wavelength and pin number
 */
export function createLEDChip(wavelength: number, anodePinNumber: string, cathodePinNumber: string): LEDChip {
	return {
		wavelength,
		anodePinNumber,
		cathodePinNumber,
		color: wavelengthToRGB(wavelength),
		colorName: `${getColorName(wavelength)} (${getColorNameZh(wavelength)})`,
	};
}

/**
 * Calculate geometry for a single LED triangle
 * Triangle points: anode on the left, cathode on the right
 *
 * @param centerX - X coordinate of the triangle center
 * @param centerY - Y coordinate of the triangle center
 * @returns Array of 6 numbers [x1,y1, x2,y2, x3,y3] for polygon
 */
function calculateTrianglePoints(centerX: number, centerY: number): number[] {
	const halfWidth = GEOMETRY.TRIANGLE_WIDTH / 2;
	const halfHeight = GEOMETRY.TRIANGLE_HEIGHT / 2;

	const x1 = centerX - halfWidth; // Base upper-left
	const y1 = centerY - halfHeight;
	const x2 = centerX - halfWidth; // Base lower-left
	const y2 = centerY + halfHeight;
	const x3 = centerX + halfWidth; // Apex on right side
	const y3 = centerY;

	return [x1, y1, x2, y2, x3, y3];
}

/**
 * Calculate light emission arrows and cathode bar decorations.
 * Arrows are positioned ABOVE the triangle, pointing NE at 45°, with filled arrowheads.
 * Coordinate system: y↑ (LCEDA schematic, y increases upward).
 */
function calculateSymbolDecorations(centerX: number, centerY: number): {
	cathodeLine: number[];
	arrow1Shaft: number[];
	arrow1Head: number[];
	arrow2Shaft: number[];
	arrow2Head: number[];
} {
	const halfWidth = GEOMETRY.TRIANGLE_WIDTH / 2; // 5
	const halfHeight = GEOMETRY.TRIANGLE_HEIGHT / 2; // 4

	// Cathode bar: vertical line at the apex (right side) of the triangle
	const cathodeLine = [
		centerX + halfWidth,
		centerY - halfHeight,
		centerX + halfWidth,
		centerY + halfHeight,
	];

	// Light emission arrows above the triangle (y > centerY + halfHeight = above in y↑ system)
	// Two parallel 45° NE-pointing arrows with 2-unit spacing
	const baseX = centerX + 1;
	const baseY = centerY + halfHeight + 2; // 2 units (20 mil) above triangle top
	const shaftLen = 3;
	const headLen = 1;
	const gap = 2; // spacing between parallel arrows

	const a1x0 = baseX;
	const a1y0 = baseY;
	const a1x1 = a1x0 + shaftLen;
	const a1y1 = a1y0 + shaftLen;

	const a2x0 = baseX + gap;
	const a2y0 = baseY;
	const a2x1 = a2x0 + shaftLen;
	const a2y1 = a2y0 + shaftLen;

	// Arrowhead: small filled right-triangle; arms point W and S from tip (↗ arrow in y↑ coords)
	return {
		cathodeLine,
		arrow1Shaft: [a1x0, a1y0, a1x1, a1y1],
		arrow1Head: [a1x1 - headLen, a1y1, a1x1, a1y1, a1x1, a1y1 - headLen],
		arrow2Shaft: [a2x0, a2y0, a2x1, a2y1],
		arrow2Head: [a2x1 - headLen, a2y1, a2x1, a2y1, a2x1, a2y1 - headLen],
	};
}

/**
 * Calculate complete geometry for multi-chip LED layout
 *
 * @param ledChips - Array of LED chips
 * @param commonTerminalType - Common terminal configuration
 * @returns Geometry data for drawing
 */
export interface LEDGeometry {
	/** Total width of the symbol */
	totalWidth: number;
	/** Total height of the symbol */
	totalHeight: number;
	/** Individual LED geometries */
	leds: Array<{
		triangle: number[];
		cathodeLine: number[];
		arrow1Shaft: number[];
		arrow1Head: number[];
		arrow2Shaft: number[];
		arrow2Head: number[];
		color: string;
		anodePinX: number;
		anodePinY: number;
		cathodePinX: number;
		cathodePinY: number;
		anodePinNumber: string;
		cathodePinNumber: string;
	}>;
	/** Common terminal position (if applicable) */
	commonTerminal?: {
		x: number;
		y: number;
		pinNumber: string;
		isCathode: boolean;
	};
}

/**
 * Calculate geometry for multi-chip LED symbol
 */
export function calculateLEDGeometry(ledChips: LEDChip[], commonTerminalType: CommonTerminalType, commonTerminalPin?: string): LEDGeometry {
	const ledCount = ledChips.length;
	if (ledCount === 0) {
		throw new Error('At least one LED chip is required');
	}

	// Calculate total width based on LED count
	const totalWidth = GEOMETRY.TRIANGLE_WIDTH + GEOMETRY.PIN_LENGTH * 2;
	const totalHeight = ledCount * GEOMETRY.TRIANGLE_HEIGHT + (ledCount - 1) * GEOMETRY.LED_SPACING;

	const centerX = 0;
	// Draw top-to-bottom: i=0 is the topmost chip (largest Y in y↑ coords)
	const startY = totalHeight / 2 - GEOMETRY.TRIANGLE_HEIGHT / 2;
	const step = GEOMETRY.TRIANGLE_HEIGHT + GEOMETRY.LED_SPACING;

	const leds: LEDGeometry['leds'] = [];

	for (let i = 0; i < ledCount; i++) {
		const chip = ledChips[i];
		// Snap each LED center Y to 50 mil grid (5 units)
		const ledCenterY = snapToGrid(startY - i * step);

		const triangle = calculateTrianglePoints(centerX, ledCenterY);
		const { cathodeLine, arrow1Shaft, arrow1Head, arrow2Shaft, arrow2Head } = calculateSymbolDecorations(centerX, ledCenterY);

		// Pin positions: offset 150 mil outward from triangle edges
		const anodePinX = centerX - GEOMETRY.TRIANGLE_WIDTH / 2 - 15;
		const anodePinY = ledCenterY;
		const cathodePinX = centerX + GEOMETRY.TRIANGLE_WIDTH / 2 + 15;
		const cathodePinY = ledCenterY;

		leds.push({
			triangle,
			cathodeLine,
			arrow1Shaft,
			arrow1Head,
			arrow2Shaft,
			arrow2Head,
			color: chip.color.hex,
			anodePinX,
			anodePinY,
			cathodePinX,
			cathodePinY,
			anodePinNumber: chip.anodePinNumber,
			cathodePinNumber: chip.cathodePinNumber,
		});
	}

	// Handle common terminal
	let commonTerminal: LEDGeometry['commonTerminal'];
	if (commonTerminalType !== 'none' && commonTerminalPin) {
		const isCathode = commonTerminalType === 'commonCathode';
		// Midpoint Y between first (top) and last (bottom) chip
		const commonY = snapToGrid(startY - ((ledCount - 1) * step) / 2);

		commonTerminal = {
			x: isCathode
				? centerX + GEOMETRY.TRIANGLE_WIDTH / 2
				: centerX - GEOMETRY.TRIANGLE_WIDTH / 2,
			y: commonY,
			pinNumber: commonTerminalPin,
			isCathode,
		};
	}

	return {
		totalWidth,
		totalHeight,
		leds,
		commonTerminal,
	};
}

/**
 * Clear all existing symbol canvas primitives (polygons + pins) before redrawing.
 */
export async function clearSymbolCanvas(): Promise<void> {
	const [polygonIds, pinIds] = await Promise.all([
		eda.sch_PrimitivePolygon.getAllPrimitiveId(),
		eda.sch_PrimitivePin.getAllPrimitiveId(),
	]);
	if (polygonIds.length > 0)
		await eda.sch_PrimitivePolygon.delete(polygonIds);
	if (pinIds.length > 0)
		await eda.sch_PrimitivePin.delete(pinIds);
}

/**
 * Draw LED symbol in the schematic editor
 * Creates the symbol with polygons and pins
 */
export async function drawLEDSymbol(geometry: LEDGeometry): Promise<void> {
	for (const led of geometry.leds) {
		// 1. Filled triangle (diode body)
		await eda.sch_PrimitivePolygon.create(led.triangle, led.color, led.color, GEOMETRY.LINE_WIDTH, null);

		// 2. Cathode bar — vertical line at the triangle apex
		await eda.sch_PrimitivePolygon.create(led.cathodeLine, led.color, null, GEOMETRY.LINE_WIDTH, null);

		// 3. Light emission arrow 1 — shaft + filled arrowhead
		await eda.sch_PrimitivePolygon.create(led.arrow1Shaft, led.color, null, GEOMETRY.LINE_WIDTH, null);
		await eda.sch_PrimitivePolygon.create(led.arrow1Head, led.color, led.color, GEOMETRY.LINE_WIDTH, null);

		// 4. Light emission arrow 2 — shaft + filled arrowhead
		await eda.sch_PrimitivePolygon.create(led.arrow2Shaft, led.color, null, GEOMETRY.LINE_WIDTH, null);
		await eda.sch_PrimitivePolygon.create(led.arrow2Head, led.color, led.color, GEOMETRY.LINE_WIDTH, null);
	}
}

/**
 * Create pins for LED symbol
 */
export async function createLEDPins(
	geometry: LEDGeometry,
	ledChips: LEDChip[],
	commonTerminalType: CommonTerminalType,
): Promise<void> {
	// Create anode pins for each LED (or use common terminal)
	for (let i = 0; i < geometry.leds.length; i++) {
		const led = geometry.leds[i];
		const chip = ledChips[i];

		// If common anode, skip individual anode pins
		if (commonTerminalType === 'commonAnode') {
			continue;
		}

		// Create anode pin on the left side
		// rotation=180: pin direction = left (connection extends left from body point)
		await eda.sch_PrimitivePin.create(
			led.anodePinX,
			led.anodePinY,
			chip.anodePinNumber,
			'A',
			180,
			GEOMETRY.PIN_LENGTH,
			null,
		);
	}

	// Create cathode pins for each LED (or use common terminal)
	for (let i = 0; i < geometry.leds.length; i++) {
		const led = geometry.leds[i];
		const chip = ledChips[i];

		// If common cathode, skip individual cathode pins
		if (commonTerminalType === 'commonCathode') {
			continue;
		}

		// Create cathode pin on the right side
		// rotation=0: pin direction = right (connection extends right from body point)
		await eda.sch_PrimitivePin.create(
			led.cathodePinX,
			led.cathodePinY,
			chip.cathodePinNumber,
			'K',
			0,
			GEOMETRY.PIN_LENGTH,
			null,
		);
	}

	// Create common terminal pin
	if (geometry.commonTerminal) {
		const ct = geometry.commonTerminal;
		// Cathode on right: direction=right (rotation=0); Anode on left: direction=left (rotation=180)
		const rotation = ct.isCathode ? 0 : 180;

		await eda.sch_PrimitivePin.create(
			ct.x,
			ct.y,
			ct.pinNumber,
			ct.isCathode ? 'K' : 'A',
			rotation,
			GEOMETRY.PIN_LENGTH,
			null,
		);
	}
}

/**
 * Generate default symbol name from LED chips
 */
export function generateSymbolName(ledChips: LEDChip[], commonTerminalType: CommonTerminalType): string {
	if (ledChips.length === 0) {
		return 'LED';
	}

	if (ledChips.length === 1) {
		const chip = ledChips[0];
		const colorName = getColorName(chip.wavelength);
		return `LED_${colorName}_${chip.wavelength}nm`;
	}

	// Multi-chip LED
	const colorNames = ledChips.map(chip => getColorName(chip.wavelength)[0]).join(''); // First letter: R, G, B
	const suffix = commonTerminalType === 'commonCathode' ? 'CC' : commonTerminalType === 'commonAnode' ? 'CA' : '';
	return `LED_${colorNames}${suffix ? '_' : ''}${suffix}`;
}

/**
 * Generate symbol description from LED chips
 */
export function generateSymbolDescription(ledChips: LEDChip[], commonTerminalType: CommonTerminalType): string {
	if (ledChips.length === 0) {
		return 'LED Symbol';
	}

	const chipDescriptions = ledChips.map(chip =>
		`${getColorName(chip.wavelength)} (${chip.wavelength}nm)`,
	).join(', ');

	const terminalDesc = commonTerminalType === 'commonCathode'
		? ' - Common Cathode'
		: commonTerminalType === 'commonAnode'
			? ' - Common Anode'
			: '';

	return `${ledChips.length}-chip LED: ${chipDescriptions}${terminalDesc}`;
}
