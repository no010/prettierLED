/**
 * Wavelength to RGB Color Conversion Module
 *
 * Converts visible light wavelength (380-780nm) to RGB color values
 * Based on CIE color matching functions approximation
 */

/**
 * RGB color representation
 */
export interface RGBColor {
	/** Red component (0-255) */
	r: number;
	/** Green component (0-255) */
	g: number;
	/** Blue component (0-255) */
	b: number;
	/** Hex color string (e.g., "#FF0000") */
	hex: string;
}

/**
 * Color category information
 */
export interface ColorInfo {
	/** Color name in English */
	nameEn: string;
	/** Color name in Chinese */
	nameZh: string;
	/** RGB color */
	color: RGBColor;
}

/**
 * Wavelength ranges for different colors (in nm)
 */
const COLOR_RANGES = [
	{ min: 380, max: 450, nameEn: 'Violet', nameZh: '紫色' },
	{ min: 450, max: 495, nameEn: 'Blue', nameZh: '蓝色' },
	{ min: 495, max: 510, nameEn: 'Cyan', nameZh: '青色' },
	{ min: 510, max: 570, nameEn: 'Green', nameZh: '绿色' },
	{ min: 570, max: 590, nameEn: 'Yellow', nameZh: '黄色' },
	{ min: 590, max: 620, nameEn: 'Orange', nameZh: '橙色' },
	{ min: 620, max: 780, nameEn: 'Red', nameZh: '红色' },
] as const;

/**
 * Convert wavelength (nm) to RGB color
 * Algorithm based on approximation of CIE 1931 color space
 *
 * @param wavelength - Wavelength in nanometers (380-780)
 * @returns RGB color object
 */
export function wavelengthToRGB(wavelength: number): RGBColor {
	// Clamp wavelength to visible spectrum
	const wl = Math.max(380, Math.min(780, wavelength));

	let r = 0;
	let g = 0;
	let b = 0;

	// Calculate RGB based on wavelength ranges
	if (wl >= 380 && wl < 440) {
		r = -(wl - 440) / (440 - 380);
		g = 0;
		b = 1;
	}
	else if (wl >= 440 && wl < 490) {
		r = 0;
		g = (wl - 440) / (490 - 440);
		b = 1;
	}
	else if (wl >= 490 && wl < 510) {
		r = 0;
		g = 1;
		b = -(wl - 510) / (510 - 490);
	}
	else if (wl >= 510 && wl < 580) {
		r = (wl - 510) / (580 - 510);
		g = 1;
		b = 0;
	}
	else if (wl >= 580 && wl < 645) {
		r = 1;
		g = -(wl - 645) / (645 - 580);
		b = 0;
	}
	else if (wl >= 645 && wl <= 780) {
		r = 1;
		g = 0;
		b = 0;
	}

	// Apply intensity factor for spectrum edges
	let factor = 1;
	if (wl >= 380 && wl < 420) {
		factor = 0.3 + (0.7 * (wl - 380)) / (420 - 380);
	}
	else if (wl >= 700 && wl <= 780) {
		factor = 0.3 + (0.7 * (780 - wl)) / (780 - 700);
	}

	// Convert to 0-255 range with gamma correction
	const gamma = 0.8;
	const rInt = Math.round(255 * Math.pow(r * factor, gamma));
	const gInt = Math.round(255 * Math.pow(g * factor, gamma));
	const bInt = Math.round(255 * Math.pow(b * factor, gamma));

	return {
		r: rInt,
		g: gInt,
		b: bInt,
		hex: rgbToHex(rInt, gInt, bInt),
	};
}

/**
 * Convert RGB values to hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (n: number) => {
		const hex = Math.max(0, Math.min(255, n)).toString(16);
		return hex.length === 1 ? `0${hex}` : hex;
	};
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Get color name from wavelength
 *
 * @param wavelength - Wavelength in nanometers (380-780)
 * @returns Color name in English
 */
export function getColorName(wavelength: number): string {
	const wl = Math.max(380, Math.min(780, wavelength));

	for (const range of COLOR_RANGES) {
		if (wl >= range.min && wl < range.max) {
			return range.nameEn;
		}
	}

	// Handle edge case for 780nm
	if (wl === 780) {
		return 'Red';
	}

	return 'Unknown';
}

/**
 * Get color name in Chinese from wavelength
 *
 * @param wavelength - Wavelength in nanometers (380-780)
 * @returns Color name in Chinese
 */
export function getColorNameZh(wavelength: number): string {
	const wl = Math.max(380, Math.min(780, wavelength));

	for (const range of COLOR_RANGES) {
		if (wl >= range.min && wl < range.max) {
			return range.nameZh;
		}
	}

	// Handle edge case for 780nm
	if (wl === 780) {
		return '红色';
	}

	return '未知';
}

/**
 * Get complete color information from wavelength
 *
 * @param wavelength - Wavelength in nanometers (380-780)
 * @returns Color info object with name and RGB
 */
export function getColorInfo(wavelength: number): ColorInfo {
	return {
		nameEn: getColorName(wavelength),
		nameZh: getColorNameZh(wavelength),
		color: wavelengthToRGB(wavelength),
	};
}

/**
 * Get common LED wavelengths with their colors
 * Useful for UI presets
 */
export function getCommonLEDWavelengths(): Array<{ wavelength: number; name: string; color: RGBColor }> {
	return [
		{ wavelength: 430, name: '紫 LED', color: wavelengthToRGB(430) },
		{ wavelength: 470, name: '蓝 LED', color: wavelengthToRGB(470) },
		{ wavelength: 505, name: '青 LED', color: wavelengthToRGB(505) },
		{ wavelength: 525, name: '绿 LED', color: wavelengthToRGB(525) },
		{ wavelength: 570, name: '黄绿 LED', color: wavelengthToRGB(570) },
		{ wavelength: 590, name: '黄 LED', color: wavelengthToRGB(590) },
		{ wavelength: 610, name: '橙 LED', color: wavelengthToRGB(610) },
		{ wavelength: 630, name: '红 LED', color: wavelengthToRGB(630) },
		{ wavelength: 660, name: '深红 LED', color: wavelengthToRGB(660) },
	];
}

/**
 * Validate wavelength value
 *
 * @param wavelength - Wavelength to validate
 * @returns true if valid visible light wavelength
 */
export function isValidWavelength(wavelength: number): boolean {
	return Number.isFinite(wavelength) && wavelength >= 380 && wavelength <= 780;
}