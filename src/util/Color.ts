// Helper function to convert from sRGB Linear to sRGB
export function sRGB(c: number) {
  if (c <= 0.0031308) {
    return c * 12.92;
  } else {
    return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }
}
