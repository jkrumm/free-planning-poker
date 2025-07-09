import { useState } from 'react';
import { ReadyState } from 'react-use-websocket';

import { ActionIcon, Tooltip } from '@mantine/core';

import { IconActivity } from '@tabler/icons-react';

import { useRoomStore } from 'fpp/store/room.store';

export const ConnectionStatus = ({
  connectedAt,
}: {
  connectedAt: number | null;
}) => {
  const readyState = useRoomStore((store) => store.readyState);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Connected',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState] as
    | 'Connecting'
    | 'Connected'
    | 'Closing'
    | 'Closed'
    | 'Uninstantiated';

  let color = 'red';

  if (connectionStatus === 'Connected') {
    color = 'green';
  }

  if (connectionStatus === 'Connecting') {
    color = 'yellow';
  }

  const [connectedSince, setConnectedSince] = useState('00:00');

  setInterval(() => {
    if (!connectedAt) {
      return;
    }
    const now = new Date();
    const connectedAtDate = new Date(connectedAt);
    const diff = now.getTime() - connectedAtDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = ((diff % 60000) / 1000).toFixed(0);
    setConnectedSince(
      `${minutes}:${seconds.length === 1 ? '0' + seconds : seconds}`,
    );
  }, 5000);

  return (
    <div className="md:pl-3 md:pr-2 pl-1 pr-1 pt-1">
      <Tooltip
        label={
          <div>
            <p>Connection Status: {connectionStatus}</p>
            {connectedAt && (
              <p>
                Connected since: <span className="mono">{connectedSince}</span>
              </p>
            )}
          </div>
        }
      >
        <ActionIcon
          variant="filled"
          color={color}
          radius="xl"
          aria-label="Connection Status"
          size="sm"
          onClick={() => {
            if (readyState === ReadyState.CLOSED) {
              window.location.reload();
            }
          }}
        >
          <IconActivity style={{ width: '90%', height: '90%' }} stroke={2} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
};
