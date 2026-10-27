/**
 * The scale that fits a line of text into the width it has. Never above 1: text only shrinks, it is not stretched
 * to fill a roomy container.
 * @param available - Width the text may use, in pixels.
 * @param natural - Width the text takes at scale 1, in pixels.
 * @returns A factor in (0, 1]. 1 when either width is not a positive number, as before layout or while hidden.
 */
export function fitScale(available: number, natural: number): number {
	if (!Number.isFinite(available) || !Number.isFinite(natural) || available <= 0 || natural <= 0) return 1;
	return Math.min(1, available / natural);
}
