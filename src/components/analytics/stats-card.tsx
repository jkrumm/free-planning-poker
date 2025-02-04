import React from 'react';

import { Card, Text } from '@mantine/core';

export const StatsCard = ({
  name,
  value,
  valueAppend,
}: {
  name: string;
  value: number | string;
  valueAppend?: string;
}) => {
  if (typeof value === 'number') {
    value = Math.round(value * 100) / 100; // Round to two decimals
  }
  return (
    <Card withBorder radius="md" padding="md">
      <Text fz="xs" tt="uppercase" fw={700} c="dimmed">
        {name}
      </Text>
      <Text fz="lg" fw={500} className="mono">
        {value} {valueAppend}
      </Text>
    </Card>
  );
};
