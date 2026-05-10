export interface AnalyticsUser {
  estimation: number | null;
  isSpectator: boolean;
  firstActive: number;
  firstActiveReadable: string;
  lastActive: number;
  lastActiveReadable: string;
}

export interface Analytics {
  connectedUsers: number;
  openRooms: number;
  rooms: {
    userCount: number;
    firstActive: number;
    firstActiveReadable: string;
    lastActive: number;
    lastActiveReadable: string;
    lastUpdated: number;
    lastUpdatedReadable: string;
    users: AnalyticsUser[];
  }[];
}
