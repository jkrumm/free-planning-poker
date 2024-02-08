import { RingProgress, Text } from '@mantine/core';

import { api } from 'fpp/utils/api';
import { secondsToReadableTime } from 'fpp/utils/number.utils';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import SidebarContent from 'fpp/components/sidebar/sidebar-content';

const Stat = ({ title, value }: { title: string; value: number | string }) => {
  return (
    <div>
      <Text fw={700} fz="xl" pb="2px">
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
          <Text color={color} size="md">
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

  if (query.isLoading || query.isError || !query.data) {
    return null;
  }

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

  console.log(query.data);

  return (
    <SidebarContent
      childrens={[
        {
          title: 'Total Votes',
          content: (
            <>
              <Stat title="Votes" value={votes} />
              <Stat title="Duration" value={secondsToReadableTime(duration)} />
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
};

export default SidebarRoomAnalytics;
