import { CustomError, InteractionType } from './room.state';

export interface AnalyticsUser {
  estimation: any;
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
  interactionsWeekly: {
    timestamp: number;
    interactionCounts: Record<(typeof InteractionType)[keyof typeof InteractionType], number>
  }[];
  interactionsDaily: {
    timestamp: number;
    interactionCounts: Record<(typeof InteractionType)[keyof typeof InteractionType], number>
  }[];
  errors: CustomError[];
}
