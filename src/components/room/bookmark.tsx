import { Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { IconBulb } from '@tabler/icons-react';

import { sendTrackEvent } from 'fpp/utils/send-track-event.util';

import { EventType } from 'fpp/server/db/schema';

export const Bookmark = ({ userId }: { userId: string }) => {
  return (
    <Badge
      leftSection={<IconBulb size={20} className="-ml-1 mb-[3px] mr-[5px]" />}
      size="xl"
      variant="outline"
      color="gray"
      className="mt-[9px] text-white/80 font-normal normal-case border-[#424242] hover:bg-[#2e2e2e] cursor-pointer"
      onClick={() => {
        if (!window.location) {
          return;
        }
        if ('clipboard' in navigator) {
          navigator.clipboard
            .writeText(window.location.toString())
            .then(() => ({}))
            .catch(() => ({}));
        } else {
          document.execCommand('copy', true, window.location.toString());
        }
        notifications.show({
          color: 'green',
          autoClose: 3000,
          withCloseButton: true,
          title: 'Room URL copied to clipboard',
          message: 'Share it with your team!',
        });
        sendTrackEvent({
          event: EventType.COPIED_ROOM_LINK,
          userId,
        });
      }}
    >
      Bookmark and share the URL
    </Badge>
  );
};
