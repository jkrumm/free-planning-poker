import { useCallback, useEffect, useRef } from 'react';
import { ReadyState } from 'react-use-websocket';

import type { HeartbeatAction } from 'fpp-server/src/room.actions';

import { WEBSOCKET_CONSTANTS } from 'fpp/constants/websocket.constants';

import {
  addBreadcrumb,
  captureError,
  captureMessage,
} from 'fpp/utils/app-error';

import { useRoomStore } from 'fpp/store/room.store';

export const useConnectionHealth = ({
  sendMessage,
  userId,
  roomId,
}: {
  sendMessage: (message: string) => void;
  userId: string;
  roomId: number;
}): void => {
  const connectionHealthRef = useRef<NodeJS.Timeout | null>(null);
  const readyState = useRoomStore((store) => store.readyState);
  const lastPongReceived = useRoomStore((store) => store.lastPongReceived);
  const reloadAttempts = useRef(0);
  const lastReloadTime = useRef(0);
  const warningIssued = useRef(false);
  const recoveryAttempts = useRef(0);
  const lastRecoveryAttempt = useRef(0);
  // eslint-disable-next-line react-hooks/purity -- Valid pattern: Initializing ref with current timestamp for visibility tracking
  const lastVisibilityChange = useRef(Date.now());
  const isTabVisible = useRef(true);
  const isUnloadingRef = useRef(false);

  // Track tab visibility to handle browser throttling
  const handleVisibilityChange = useCallback(() => {
    const wasVisible = isTabVisible.current;
    isTabVisible.current = !document.hidden;
    lastVisibilityChange.current = Date.now();

    if (!wasVisible && isTabVisible.current) {
      // Tab became visible again - reset warnings and check connection
      addBreadcrumb(
        'Tab became visible - resetting connection health state',
        'websocket',
      );
      warningIssued.current = false;
      recoveryAttempts.current = 0;

      // Send immediate heartbeat to check connection
      sendMessage(
        JSON.stringify({
          userId,
          roomId,
          action: 'heartbeat',
        } satisfies HeartbeatAction),
      );
    }
  }, [sendMessage, userId, roomId]);

  // Recovery strategy before resorting to reload
  const attemptRecovery = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRecovery = now - lastRecoveryAttempt.current;

    // Don't spam recovery attempts
    if (timeSinceLastRecovery < 5000) {
      return;
    }

    recoveryAttempts.current++;
    lastRecoveryAttempt.current = now;

    addBreadcrumb('Attempting connection recovery', 'websocket', {
      attempt: recoveryAttempts.current,
      maxAttempts: 2, // Reduced to 2 attempts
    });

    // Send heartbeat immediately and one more after 2 seconds
    sendMessage(
      JSON.stringify({
        userId,
        roomId,
        action: 'heartbeat',
      } satisfies HeartbeatAction),
    );

    setTimeout(() => {
      sendMessage(
        JSON.stringify({
          userId,
          roomId,
          action: 'heartbeat',
        } satisfies HeartbeatAction),
      );
    }, 2000);
  }, [sendMessage, userId, roomId]);

  useEffect(() => {
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track page unload to skip error capture when user closes tab
    // Both events needed: beforeunload for legacy support, pagehide for modern browsers
    const handleUnload = () => {
      isUnloadingRef.current = true;
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [handleVisibilityChange]);

  useEffect(() => {
    try {
      if (readyState === ReadyState.OPEN) {
        const checkConnectionHealth = () => {
          try {
            const timeSinceLastPong = Date.now() - lastPongReceived;
            const timeSinceLastReload = Date.now() - lastReloadTime.current;
            const timeSinceVisibilityChange =
              Date.now() - lastVisibilityChange.current;

            // Skip health checks if tab was recently invisible (browser throttling)
            if (!isTabVisible.current || timeSinceVisibilityChange < 3000) {
              return;
            }

            // Warning level - log and send heartbeat
            if (
              timeSinceLastPong > WEBSOCKET_CONSTANTS.PONG_TIMEOUT_WARNING &&
              !warningIssued.current
            ) {
              addBreadcrumb('Connection health warning', 'websocket', {
                timeSinceLastPong,
                userId,
                roomId,
                isTabVisible: isTabVisible.current,
              });

              // Only capture as warning if it's been a while since connection was established
              // This avoids noise during normal reconnection cycles
              if (timeSinceLastPong > 60000) {
                // Only warn after 60 seconds
                captureMessage(
                  'Connection health warning - no pong received',
                  {
                    component: 'useConnectionHealth',
                    action: 'checkConnectionHealth',
                    extra: {
                      timeSinceLastPong,
                      pongTimeoutWarning:
                        WEBSOCKET_CONSTANTS.PONG_TIMEOUT_WARNING,
                      isTabVisible: isTabVisible.current,
                    },
                  },
                  'warning',
                );
              }

              warningIssued.current = true;
              sendMessage(
                JSON.stringify({
                  userId,
                  roomId,
                  action: 'heartbeat',
                } satisfies HeartbeatAction),
              );
            }

            // Recovery level - try reconnection strategies
            if (
              timeSinceLastPong > WEBSOCKET_CONSTANTS.PONG_TIMEOUT_CRITICAL &&
              recoveryAttempts.current < 2 &&
              timeSinceLastReload > WEBSOCKET_CONSTANTS.RELOAD_COOLDOWN
            ) {
              attemptRecovery();
              return;
            }

            // Critical level - reload after recovery attempts failed or sufficient time passed
            if (
              timeSinceLastPong >
                WEBSOCKET_CONSTANTS.PONG_TIMEOUT_CRITICAL + 5000 && // Only 5s buffer
              timeSinceLastReload > WEBSOCKET_CONSTANTS.RELOAD_COOLDOWN &&
              (recoveryAttempts.current >= 2 || timeSinceLastPong > 90000) && // Either recovery failed OR 90s total
              reloadAttempts.current < 3
            ) {
              // Skip error capture and reload if user is closing the tab
              // This prevents false positives when tab closure causes connection timeout
              if (isUnloadingRef.current) {
                addBreadcrumb(
                  'Connection health critical during page unload - skipping',
                  'websocket',
                  { timeSinceLastPong },
                );
                return;
              }

              addBreadcrumb(
                'Connection health critical - forcing reload',
                'websocket',
                {
                  timeSinceLastPong,
                  timeSinceLastReload,
                  reloadAttempts: reloadAttempts.current,
                  recoveryAttempts: recoveryAttempts.current,
                  reason:
                    recoveryAttempts.current >= 2
                      ? 'recovery_failed'
                      : 'timeout_exceeded',
                },
              );

              captureError(
                'Connection health critical - forcing reconnection',
                {
                  component: 'useConnectionHealth',
                  action: 'checkConnectionHealth',
                  extra: {
                    timeSinceLastPong,
                    timeSinceLastReload,
                    reloadAttempts: reloadAttempts.current,
                    recoveryAttempts: recoveryAttempts.current,
                    pongTimeoutCritical:
                      WEBSOCKET_CONSTANTS.PONG_TIMEOUT_CRITICAL,
                    isTabVisible: isTabVisible.current,
                  },
                },
                'high',
              );

              reloadAttempts.current++;
              lastReloadTime.current = Date.now();
              window.location.reload();
            }
          } catch (error) {
            captureError(
              error instanceof Error
                ? error
                : new Error('Failed to check connection health'),
              {
                component: 'useConnectionHealth',
                action: 'checkConnectionHealth',
                extra: {
                  timeSinceLastPong: Date.now() - lastPongReceived,
                  readyState: ReadyState[readyState],
                  isTabVisible: isTabVisible.current,
                },
              },
              'high',
            );
          }
        };

        connectionHealthRef.current = setInterval(
          checkConnectionHealth,
          WEBSOCKET_CONSTANTS.CONNECTION_HEALTH_CHECK,
        );

        addBreadcrumb('Connection health monitoring started', 'websocket');
      }

      // Reset counters when connection is established
      if (readyState === ReadyState.OPEN) {
        reloadAttempts.current = 0;
        warningIssued.current = false;
        recoveryAttempts.current = 0;
      }
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize connection health monitoring'),
        {
          component: 'useConnectionHealth',
          action: 'initialization',
          extra: {
            readyState: ReadyState[readyState],
          },
        },
        'high',
      );
    }

    return () => {
      try {
        if (connectionHealthRef.current) {
          clearInterval(connectionHealthRef.current);
          addBreadcrumb('Connection health monitoring stopped', 'websocket');
        }
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to cleanup connection health monitoring'),
          {
            component: 'useConnectionHealth',
            action: 'cleanup',
          },
          'low',
        );
      }
    };
  }, [
    readyState,
    lastPongReceived,
    sendMessage,
    userId,
    roomId,
    attemptRecovery,
  ]);
};
