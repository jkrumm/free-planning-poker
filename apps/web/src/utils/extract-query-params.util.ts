export function extractQueryParams(url: string): Record<string, string | null> {
  const paramsObj: Record<string, string | null> = {};
  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search); // parse query parameters
  for (const key of params.keys()) {
    if (params.get(key) == null || params.get(key) == undefined) {
      paramsObj[key] = null;
    } else {
      paramsObj[key] = params.get(key);
    }
  }
  return paramsObj;
}
