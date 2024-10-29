import React from 'react';

import { Card, Group, Text, Title } from '@mantine/core';

export const AnalyticsCard = ({
  data,
  headline,
}: {
  data: Record<string, number>;
  headline: string;
}) => {
  const sortedData = Object.entries(data)
    .sort((a, b) => b[1] - a[1]) // Sort by value in descending order
    .slice(0, 30) // Get the first 30 entries
    .map(([name, value]) => ({ name, value })); // Map to objects with name and value

  const highestValue = sortedData[0]?.value ?? 0; // Get the highest value

  return (
    <Card withBorder shadow="sm" radius="md">
      <Card.Section withBorder inheritPadding py="xs">
        <Title order={2} size="md">
          {headline}
        </Title>
      </Card.Section>
      <Card.Section className="px-2 overflow-y-scroll max-h-[400px] scrollbar-hide">
        {sortedData.map((item, index) => (
          <Group key={index} className="relative py-2">
            <div
              className="absolute h-[40px] w-full rounded bg-[#242424]"
              style={{ width: `${(item.value / highestValue) * 100}%` }}
            />
            <Text fz="md" className="z-10 m-2">
              {item.name}
            </Text>
            <Text fz="md" className="z-10 m-2 ml-auto">
              {item.value}
            </Text>
          </Group>
        ))}
      </Card.Section>
    </Card>
  );
};
