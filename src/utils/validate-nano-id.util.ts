export function validateNanoId(nanoId: string | null | undefined): boolean {
  if (!nanoId) return false;
  const allowedChars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
  return (
    nanoId.length === 21 && [...nanoId].every((x) => allowedChars.includes(x))
  );
}
