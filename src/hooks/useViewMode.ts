import { useEffect, useState } from 'react';

import { useRoomStore } from 'fpp/store/room.store';

export const useViewMode = () => {
  const [isMobile, setIsMobile] = useState(false);
  const users = useRoomStore((store) => store.users);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const playersOnly = users.filter((user) => !user.isSpectator);
  const shouldUseCardList = isMobile || playersOnly.length > 8;

  return shouldUseCardList ? 'cardList' : 'table';
};
