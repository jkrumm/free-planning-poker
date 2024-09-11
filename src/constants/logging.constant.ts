export const logMsg = {
  TRACK_ROOM_EVENT: 'TRACK_ROOM_EVENT',
  ENDPOINT_FAILED: 'ENDPOINT_FAILED',
  SSG_FAILED: 'SSG_FAILED',
  GET_FEATURE_FLAGS_FAILED: 'GET_FEATURE_FLAGS_FAILED',
  GET_ROOMS_FAILED: 'GET_ROOMS_FAILED',
  INCOMING_MESSAGE: 'INCOMING_MESSAGE',
  INCOMING_ERROR: 'INCOMING_ERROR',
} as const;

export const logEndpoint = {
  TRACK_PAGE_VIEW: 'TRACK_PAGE_VIEW',
  TRACK_EVENT: 'TRACK_EVENT',
  GET_ANALYTICS: 'GET_ANALYTICS',
  DAILY_ANALYTICS: 'DAILY_ANALYTICS',
  TRACK_ESTIMATION: 'TRACK_ESTIMATION',
  GET_ROOMS: 'GET_ROOMS',
  GET_LATEST_TAG: 'GET_LATEST_TAG',
  GET_FEATURE_FLAGS: 'GET_FEATURE_FLAGS',
} as const;
