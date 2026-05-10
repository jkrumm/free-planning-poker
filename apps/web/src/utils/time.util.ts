export function dateToTimestamp(date: Date | number): string {
  // Convert date to timestamp
  date = new Date(date);
  // Extract hours, minutes, and seconds
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  // Format the time as HH:MM:SS
  return `${hours}:${minutes}:${seconds}`;
}
