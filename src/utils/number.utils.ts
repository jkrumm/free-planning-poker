export function round(value: number | string) {
  return Math.ceil(Number(value) * 100) / 100;
}

export function isValidInteger(str: string) {
  if (!str.trim()) return false;
  return Number.isInteger(Number(str));
}

export function isValidMediumint(str: string) {
  if (!str.trim()) return false;
  return Number.isInteger(Number(str)) && Number(str) < 8388607;
}
