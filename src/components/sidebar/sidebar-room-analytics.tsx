import { RingProgress, Text } from '@mantine/core';

import { api } from 'fpp/utils/api';
import { addBreadcrumb, captureError } from 'fpp/utils/app-error';
import { secondsToReadableTime } from 'fpp/utils/number.utils';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import SidebarContent from 'fpp/components/sidebar/sidebar-content';

const Stat = ({ title, value }: { title: string; value: number | string }) => {
  return (
    <div>
      <Text fw={700} fz="md" pb="2px" className="mono">
        {value}
      </Text>
      <Text c="dimmed" tt="uppercase" fw={700} fz="xs" mb="4px">
        {title}
      </Text>
    </div>
  );
};

const VoteRing = ({ value, name }: { value: number; name: string }) => {
  const color =
    value < 4 ? 'green' : value < 6 ? 'yellow' : value < 8 ? 'orange' : 'red';

  return (
    <div>
      <RingProgress
        size={80}
        thickness={9}
        sections={[{ value: (value / 21) * 100, color }]}
        label={
          <Text color={color} size="md" className="mono">
            {value}
          </Text>
        }
      />
      <Text c="dimmed" tt="uppercase" fw={700} fz="xs">
        {name}
      </Text>
    </div>
  );
};

const SidebarRoomAnalytics = () => {
  const roomId = useLocalstorageStore((state) => state.roomId);

  if (!roomId) {
    return null;
  }

  const query = api.room.getRoomStats.useQuery({ roomId });

  if (query.isLoading) {
    addBreadcrumb('Loading room analytics', 'analytics', { roomId });
    return null;
  }

  if (query.isError) {
    captureError(
      query.error || 'Failed to load room analytics',
      {
        component: 'SidebarRoomAnalytics',
        action: 'loadRoomStats',
        extra: {
          roomId,
          errorStatus: query.status,
        },
      },
      'medium',
    );
    return null;
  }

  if (!query.data) {
    captureError(
      'Room analytics data is null',
      {
        component: 'SidebarRoomAnalytics',
        action: 'validateData',
        extra: {
          roomId,
          queryStatus: query.status,
        },
      },
      'low',
    );
    return null;
  }

  try {
    const {
      votes,
      duration,
      estimations,
      estimations_per_vote,
      avg_min_estimation,
      avg_avg_estimation,
      avg_max_estimation,
      spectators,
      spectators_per_vote,
    } = query.data;

    addBreadcrumb('Room analytics loaded successfully', 'analytics', {
      roomId,
      votes,
      estimations,
      spectators,
    });

    return (
      <SidebarContent
        childrens={[
          {
            title: 'Total Votes',
            content: (
              <>
                <Stat title="Votes" value={votes} />
                <Stat
                  title="Duration"
                  value={secondsToReadableTime(duration)}
                />
              </>
            ),
          },
          {
            title: 'Total Estimations',
            content: (
              <>
                <Stat title="Estimations" value={estimations} />
                <Stat title="Per Vote" value={estimations_per_vote} />
              </>
            ),
          },
          {
            title: 'Average Estimations',
            content: (
              <>
                <VoteRing value={avg_min_estimation} name="LOW" />
                <VoteRing value={avg_avg_estimation} name="AVG" />
                <VoteRing value={avg_max_estimation} name="HIGH" />
              </>
            ),
          },
          {
            title: 'Total Spectators',
            content: (
              <>
                <Stat title="Spectators" value={spectators} />
                <Stat title="Per Vote" value={spectators_per_vote} />
              </>
            ),
          },
        ]}
      />
    );
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to render room analytics'),
      {
        component: 'SidebarRoomAnalytics',
        action: 'renderAnalytics',
        extra: {
          roomId,
          hasData: !!query.data,
        },
      },
      'medium',
    );
    return null;
  }
};

export default SidebarRoomAnalytics;
