export function generateRoomNumber() {
  return Math.floor(Math.random() * (999999 - 100000) + 100000); //NOSONAR
}
