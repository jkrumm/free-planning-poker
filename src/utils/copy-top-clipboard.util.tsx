import { notifications } from '@mantine/notifications';

import { sendTrackEvent } from 'fpp/utils/send-track-event.util';

import { EventType } from 'fpp/server/db/schema';

export const copyToClipboard = (text: string, userId: string): void => {
  // Handle async operations internally
  const performCopy = async () => {
    try {
      if ('clipboard' in navigator) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for browsers without clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (!successful) {
          throw new Error('Copy command failed');
        }
      }

      // Show success notification
      notifications.show({
        color: 'green',
        autoClose: 3000,
        withCloseButton: true,
        title: 'Room URL copied to clipboard',
        message: 'Share it with your team!',
      });

      // Track the event
      sendTrackEvent({
        event: EventType.COPIED_ROOM_LINK,
        userId,
      });
    } catch (error) {
      // Show error notification
      notifications.show({
        color: 'red',
        autoClose: 3000,
        withCloseButton: true,
        title: 'Failed to copy URL',
        message: 'Please copy the URL manually from the address bar',
      });
    }
  };

  // Fire and forget - don't return the promise
  performCopy()
    .then(() => ({}))
    .catch(() => ({}));
};
