export function round(value: number | string) {
  return Math.ceil(Number(value) * 100) / 100;
}
