/** The site's path of a built page: no `.html`, no trailing slash except for the root. */
export function canonicalPath(pathname: string): string {
  const path = pathname.replace(/\.html$/, '').replace(/\/index$/, '/')
  return path.length > 1 ? path.replace(/\/+$/, '') : '/'
}
