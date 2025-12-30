import React, { type ReactNode, useEffect } from 'react';

import { getCurrentScope } from '@sentry/nextjs';

interface SentryContextProviderProps {
  children: ReactNode;
  userId?: string;
  roomId?: number;
  username?: string;
}

export const SentryContextProvider: React.FC<SentryContextProviderProps> = ({
  children,
  userId,
  roomId,
  username,
}) => {
  useEffect(() => {
    // Set global Sentry context when room/user data changes
    const scope = getCurrentScope();
    scope.clear();

    // Set user context
    if (userId) {
      scope.setUser({ id: userId });
      scope.setTag('userId', userId);
    }

    // Set room context
    if (roomId) {
      scope.setTag('roomId', roomId.toString());
      scope.setContext('room', {
        id: roomId,
        name: username ?? 'Unknown Room',
      });
    }

    // Set additional context
    if (username) {
      scope.setExtra('username', username);
    }

    // Add breadcrumb when context is set
    scope.addBreadcrumb({
      message: 'Room context updated',
      category: 'room',
      level: 'info',
      data: {
        userId: userId ?? 'unknown',
        roomId: roomId ?? 'unknown',
        username: username ?? 'unknown',
      },
    });
  }, [userId, roomId, username]);

  return <>{children}</>;
};
