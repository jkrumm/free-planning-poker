export function isValidMediumint(str: string) {
  if (!str.trim()) return false;
  return Number.isInteger(Number(str)) && Number(str) < 8388607;
}
