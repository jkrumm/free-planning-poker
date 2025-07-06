import { useEffect, useRef } from 'react';

import { type Action } from 'fpp-server/src/room.actions';

import { useRoomStore } from 'fpp/store/room.store';

interface PresenceTrackingConfig {
  triggerAction: (action: Action) => void;
  sendHeartbeat: () => void;
  roomId: number;
  userId: string;
}

export const usePresenceTracking = ({
  triggerAction,
  sendHeartbeat,
  roomId,
  userId,
}: PresenceTrackingConfig): void => {
  const visibilityHeartbeatRef = useRef<NodeJS.Timeout>();
  const setLastPongReceived = useRoomStore(
    (store) => store.setLastPongReceived,
  );

  useEffect(() => {
    const updatePresence = (isPresent: boolean) => {
      console.debug('Updating presence:', { isPresent, userId, roomId });
      triggerAction({
        action: 'setPresence',
        roomId,
        userId,
        isPresent,
      });
    };

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      console.debug('Visibility changed:', {
        isVisible,
        hidden: document.hidden,
      });
      updatePresence(isVisible);

      if (isVisible) {
        console.debug('Tab became visible - sending immediate heartbeat');

        // Clear any existing timeout and send immediate heartbeat
        if (visibilityHeartbeatRef.current) {
          clearTimeout(visibilityHeartbeatRef.current);
        }

        // Send heartbeat after a small delay to ensure tab is fully active
        visibilityHeartbeatRef.current = setTimeout(() => {
          sendHeartbeat();
          // Reset the pong timer since we're active again
          setLastPongReceived(Date.now());
        }, 100);
      }
    };

    const handleFocus = () => {
      console.debug('Window focused - user is active');
      updatePresence(true);
      sendHeartbeat();
    };

    const handleBlur = () => {
      console.debug('Window blurred - user is away');
      updatePresence(false);
    };

    // Network change detection
    const handleOnline = () => {
      console.debug('Network came online - sending heartbeat');
      sendHeartbeat();
    };

    // Set initial presence based on current visibility and focus state
    const isCurrentlyActive = !document.hidden && document.hasFocus();
    updatePresence(isCurrentlyActive);

    // Add all event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('online', handleOnline);
      if (visibilityHeartbeatRef.current) {
        clearTimeout(visibilityHeartbeatRef.current);
      }
    };
  }, [sendHeartbeat, setLastPongReceived, triggerAction, roomId, userId]);
};
