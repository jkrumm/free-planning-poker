import SidebarContent from "fpp/components/room/sidebar/sidebar-content";
import { RingProgress, Text } from "@mantine/core";

const Stat = ({ title, value }: { title: string; value: number }) => {
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
    value < 4 ? "green" : value < 6 ? "yellow" : value < 8 ? "orange" : "red";

  return (
    <div>
      <RingProgress
        size={80}
        thickness={9}
        sections={[{ value: (value / 21) * 100, color }]}
        label={
          <Text color={color} weight={700} align="center" size="md">
            {value}
          </Text>
        }
      />
      <Text c="dimmed" tt="uppercase" fw={700} fz="xs" align="center">
        {name}
      </Text>
    </div>
  );
};

const SidebarRoomAnalytics = () => {
  return (
    <SidebarContent
      childrens={[
        {
          title: "Total Votes",
          content: (
            <>
              <Stat title="Votes" value={500} />
              <Stat title="Per Month" value={6} />
              <Stat title="Duration" value={20} />
            </>
          ),
        },
        {
          title: "Total Estimations",
          content: (
            <>
              <Stat title="Estimations" value={1500} />
              <Stat title="Per Vote" value={3} />
            </>
          ),
        },
        {
          title: "Average Estimations",
          content: (
            <>
              <VoteRing value={3.5} name="LOW" />
              <VoteRing value={5} name="AVG" />
              <VoteRing value={7} name="HIGH" />
            </>
          ),
        },
        {
          title: "Total Spectators",
          content: (
            <>
              <Stat title="Spectators" value={200} />
              <Stat title="Per Vote" value={0.4} />
            </>
          ),
        },
      ]}
    />
  );
};

export default SidebarRoomAnalytics;
