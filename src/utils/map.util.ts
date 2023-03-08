export function getByValue(map: Map<string, string>, searchValue: string) {
  for (const [key, value] of map.entries()) {
    if (value === searchValue) return key;
  }
}
