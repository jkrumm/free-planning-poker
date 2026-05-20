import { useEffect, useState } from 'react';

import { recordError } from 'fpp/utils/app-error';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStore } from 'fpp/store/room.store';

export const useViewMode = () => {
  const [isMobile, setIsMobile] = useState(false);
  const users = useRoomStore((store) => store.users);
  const preferCardView = useLocalstorageStore((store) => store.preferCardView);

  useEffect(() => {
    const checkScreenSize = () => {
      try {
        const newIsMobile = window.innerWidth < 768;
        setIsMobile(newIsMobile);
      } catch (error) {
        recordError(
          error instanceof Error
            ? error
            : new Error('Failed to check screen size'),
          {
            component: 'useViewMode',
            action: 'checkScreenSize',
          },
          'low',
        );
      }
    };

    try {
      checkScreenSize();
      window.addEventListener('resize', checkScreenSize);
    } catch (error) {
      recordError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize view mode'),
        {
          component: 'useViewMode',
          action: 'initialization',
        },
        'medium',
      );
    }

    return () => {
      try {
        window.removeEventListener('resize', checkScreenSize);
      } catch (error) {
        recordError(
          error instanceof Error
            ? error
            : new Error('Failed to cleanup view mode'),
          {
            component: 'useViewMode',
            action: 'cleanup',
          },
          'low',
        );
      }
    };
  }, []);

  try {
    const playersOnly = users.filter((user) => !user.isSpectator);
    const shouldUseCardList =
      preferCardView || isMobile || playersOnly.length > 8;

    return shouldUseCardList ? 'cardList' : 'table';
  } catch (error) {
    recordError(
      error instanceof Error
        ? error
        : new Error('Failed to determine view mode'),
      {
        component: 'useViewMode',
        action: 'calculateViewMode',
        extra: {
          preferCardView,
          isMobile,
          userCount: users.length,
        },
      },
      'medium',
    );

    // Return safe default
    return 'table';
  }
};
