import { useEffect, useState } from 'react';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStore } from 'fpp/store/room.store';

export const useViewMode = () => {
  const [isMobile, setIsMobile] = useState(false);
  const users = useRoomStore((store) => store.users);
  const preferCardView = useLocalstorageStore((store) => store.preferCardView);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const playersOnly = users.filter((user) => !user.isSpectator);
  const shouldUseCardList =
    preferCardView || isMobile || playersOnly.length > 8;

  return shouldUseCardList ? 'cardList' : 'table';
};
