export type PlausibleEvents = {
  joined: { room: string };
  recent: { room: string };
  created: { room: string };
  entered: { room: string };
  voted: { players: number; room: string };
};
