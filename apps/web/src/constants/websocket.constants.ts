export const WEBSOCKET_CONSTANTS = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds - send heartbeat
  PONG_TIMEOUT_WARNING: 45000, // 45 seconds - log warning
  PONG_TIMEOUT_CRITICAL: 65000, // 65 seconds - take action
  CONNECTION_HEALTH_CHECK: 15000, // 15 seconds - check frequency
  MAX_MISSED_PONGS: 2, // Allow 2 missed pongs before action
  RELOAD_COOLDOWN: 30000, // 30 seconds between reloads
};
