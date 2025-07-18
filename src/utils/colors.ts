// Copyright (c) ETH Zurich and the rendure authors. All rights reserved.

// From: https://eleanormaclure.files.wordpress.com/2011/03/colour-coding.pdf,
// Via: https://stackoverflow.com/a/4382138/3547036
export const KELLY_COLORS = [
    0xFFB300, // Vivid Yellow
    0x803E75, // Strong Purple
    0xFF6800, // Vivid Orange
    0xA6BDD7, // Very Light Blue
    0xC10020, // Vivid Red
    0xCEA262, // Grayish Yellow
    0x817066, // Medium Gray

    // The following don't work well for people with defective color vision.
    0x007D34, // Vivid Green
    0xF6768E, // Strong Purplish Pink
    0x00538A, // Strong Blue
    0xFF7A5C, // Strong Yellowish Pink
    0x53377A, // Strong Violet
    0xFF8E00, // Vivid Orange Yellow
    0xB32851, // Strong Purplish Red
    0xF4C800, // Vivid Greenish Yellow
    0x7F180D, // Strong Reddish Brown
    0x93AA00, // Vivid Yellowish Green
    0x593315, // Deep Yellowish Brown
    0xF13A13, // Vivid Reddish Orange
    0x232C16, // Dark Olive Green
];

/**
 * Convert an HSL color to RGB.
 * @param h Hue.
 * @param s Saturation.
 * @param l Lightness.
 * @returns RGB value array.
 */
export function hsl2rgb(
    h: number, s: number, l: number
): [number, number, number] {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number, k = (n + h / 30) % 12): number => {
        return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return [f(0), f(8), f(4)];
}

/**
 * Map a HSL color array to a HSL color string used in CSS / HTML.
 * @param colorArr HSL color array [hue, saturation, lightness].
 * @returns        HSL color string
 */
export function hsl2string(colorArr: [number, number, number]): string {
    return 'hsl(' + colorArr[0].toString() + ',' +
        (colorArr[1] * 100).toString() + '%,' +
        (colorArr[2] * 100).toString() + '%)';
}

/**
 * Convert a RGB color value to a hex color string.
 * @param rgbVal RGB color value (0-255).
 * @returns      Hex color string representation ('00' to 'FF'), without '#'.
 */
export function rgbVal2hex(rgbVal: number): string {
    const hex = Math.round(rgbVal).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

/**
 * Convert a RGB color value to a hex color string.
 * @param rgb RGB color value array [r, g, b].
 * @returns   Hex color string representation ('#RRGGBB').
 */
export function rgb2hex(rgb: [number, number, number]): string;

/**
 * Convert a RGB color value to a hex color string.
 * @param r  Red value (0-255).
 * @param g  Green value (0-255).
 * @param b  Blue value (0-255).
 * @returns  Hex color string representation ('#RRGGBB').
 */
export function rgb2hex(r: number, g: number, b: number): string;

export function rgb2hex(...args: unknown[]): string {
    let locR: number, locG: number, locB: number;
    if (args.length === 1) {
        [locR, locG, locB] = args[0] as [number, number, number];
    } else if (args.length === 3) {
        [locR, locG, locB] = args as [number, number, number];
    } else {
        throw new Error(
            'Single RGB array or three separate RGB values expected'
        );
    }

    return '#' + rgbVal2hex(locR) + rgbVal2hex(locG) + rgbVal2hex(locB);
}

/**
 * Expand shorthand hex form (e.g. "03F") to full form (e.g. "0033FF").
 * @param hex Hex color string representation ('(#)RRGGBB' or '(#)RGB').
 * @returns   Full hex color string representation ('(#)RRGGBB').
 */
export function expandHex(hex: string): string {
    return hex.replace(
        /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
        (m: string, r: string, g: string, b: string) => {
            return r + r + g + g + b + b;
        }
    );
}

/**
 * Convert a hex color string to a hex value array.
 * @param hex  Hex color string representation ('(#)RRGGBB' or '(#)RGB').
 * @returns    Hex color number (0xRRGGBB) or null if the input is invalid.
 */
export function hex2hexnum(hex: string): number | null {
    const result = /^#?([a-f\d]{6})$/i.exec(hex);
    return result ? parseInt(result[1], 16) : null;
}

/**
 * Convert a hex color string to a RGB color value array.
 * @param hex  Hex color string representation ('(#)RRGGBB' or '(#)RGB').
 * @returns    RGB color value array [r, g, b] or null if the input is invalid.
 */
export function hex2rgb(hex: string): [number, number, number] | null {
    hex = expandHex(hex);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
    ] : null;
}

/**
 * Map a value between 0-1 onto a green-red temperature color scale.
 * @param temp  Value between 0 and 1, 0 = green, .5 = yellow, 1 = red
 * @returns     HSL [hue, saturation, lightness] of the corresponding color.
 */
export function tempColor(temp: number): [number, number, number] {
    if (Number.isNaN(temp))
        temp = 0;

    if (temp < 0)
        temp = 0;
    else if (temp > 1)
        temp = 1;

    // The hue of the green-red spectrum must lie between 0 and 120, so we map
    // the 'badness' to that interval (inverted, since green=120 hue and
    // red=0 hue).
    const maxHue = 120;
    const saturation = 1.0;
    const lightness = 0.75;
    return [(1 - temp) * maxHue, saturation, lightness];
}

/**
 * Shade a color by a percentage.
 * @param color   Hex color string representation ('#RRGGBB').
 * @param percent Percentage to shade the color, e.g. -20 for 20% darker.
 * @returns       Shaded hex color string representation ('#RRGGBB').
 */
export function shadeHexColor(color: string, percent: number): string {
    const rgb = hex2rgb(color);
    if (!rgb)
        throw new Error('Invalid color format');

    rgb[0] = (rgb[0] * (100 + percent)) / 100;
    rgb[1] = (rgb[1] * (100 + percent)) / 100;
    rgb[2] = (rgb[2] * (100 + percent)) / 100;

    rgb[0] = rgb[0] < 255 ? Math.round(rgb[0]) : 255;
    rgb[1] = rgb[1] < 255 ? Math.round(rgb[1]) : 255;
    rgb[2] = rgb[2] < 255 ? Math.round(rgb[2]) : 255;

    const rVal = rgb[0].toString(16);
    const gVal = rgb[1].toString(16);
    const bVal = rgb[2].toString(16);
    return '#' +
        (rVal.length === 1? '0' + rVal : rVal) +
        (gVal.length === 1? '0' + gVal : gVal) +
        (bVal.length === 1? '0' + bVal : bVal);
}
