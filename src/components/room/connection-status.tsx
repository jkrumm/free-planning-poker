import { useState } from 'react';
import { ReadyState } from 'react-use-websocket';

import { ActionIcon, Tooltip } from '@mantine/core';

import { IconActivity } from '@tabler/icons-react';

export const ConnectionStatus = ({
  readyState,
  connectedAt,
}: {
  readyState: ReadyState;
  connectedAt: number | null;
}) => {
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
    <div className="p-3">
      <Tooltip
        label={
          <div>
            <p>Connection Status: {connectionStatus}</p>
            {connectedAt && <p>Connected since: {connectedSince}</p>}
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
