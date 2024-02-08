export function isValidMediumint(str: string) {
  if (!str.trim()) return false;
  return Number.isInteger(Number(str)) && Number(str) < 8388607;
}

export function secondsToReadableTime(seconds: number) {
  // First, we calculate the number of minutes by dividing the seconds by 60
  // and rounding down to the nearest whole number
  const minutes = Math.floor(seconds / 60);

  // Next, we calculate the remaining seconds by finding the remainder of the
  // seconds divided by 60 (this is what the '%' operator does)
  const remainingSeconds = seconds % 60;

  // We "pad" the seconds with a zero if there are less than 10
  const displayedSeconds =
    remainingSeconds < 10 ? '0' + remainingSeconds : '' + remainingSeconds;

  return `${minutes} : ${displayedSeconds}`;
}
