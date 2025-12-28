import React, { useEffect, useRef, useState } from 'react';

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
  const prevValue = useRef<number | string>(value);
  const [flash, setFlash] = useState<'increase' | 'decrease' | null>(null);
  const isFirstUpdate = useRef(true);

  useEffect(() => {
    if (typeof value === 'number' && typeof prevValue.current === 'number') {
      if (value !== prevValue.current) {
        if (isFirstUpdate.current) {
          isFirstUpdate.current = false;
          prevValue.current = value;
        } else {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid pattern: Timer-based flash animation on value change
          setFlash(value > prevValue.current ? 'increase' : 'decrease');
          prevValue.current = value;
          const timer = setTimeout(() => setFlash(null), 1000);
          return () => clearTimeout(timer);
        }
      }
    } else {
      prevValue.current = value;
    }
  }, [value]);

  const displayValue =
    typeof value === 'number' ? Math.round(value * 10000) / 10000 : value;

  const borderClass =
    flash === 'increase'
      ? 'border-green-500/30'
      : flash === 'decrease'
        ? 'border-red-500/30'
        : 'border-[#424242]';

  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      className={`transition-colors duration-300 ${borderClass}`}
    >
      <Text fz="xs" tt="uppercase" fw={700} c="dimmed">
        {name}
      </Text>
      <Text fz="lg" fw={500} className="mono">
        {displayValue} {valueAppend}
      </Text>
    </Card>
  );
};
