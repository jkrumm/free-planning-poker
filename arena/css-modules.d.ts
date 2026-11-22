/** A CSS module, as Vite builds it: the class names of the file, each made unique to it. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
