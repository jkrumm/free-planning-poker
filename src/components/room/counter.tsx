import { useEffect, useState } from 'react';

import { Tooltip } from '@mantine/core';

import {
  type MotionValue,
  motion,
  useSpring,
  useTransform,
} from 'framer-motion';

import { useRoomStateStore } from 'fpp/store/room-state.store';

const fontSize = 18;
const padding = 18;
const height = fontSize + padding;

function Counter() {
  const startedAt = useRoomStateStore((store) => store.startedAt);
  const isFlipped = useRoomStateStore((store) => store.isFlipped);

  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  const setMinutesAndSeconds = () => {
    const totalSeconds = (Date.now() - startedAt) / 1000;
    const minutesLocal = Math.floor(totalSeconds / 60);
    setMinutes(minutesLocal);
    const secondsLocal = totalSeconds - minutesLocal * 60;
    setSeconds(secondsLocal - (secondsLocal % 5));
  };

  useEffect(() => {
    setMinutesAndSeconds();
    const timer = setInterval(() => {
      if (!isFlipped) {
        setMinutesAndSeconds();
      }
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [startedAt, isFlipped]);

  return (
    <div className="mb-[19px] border-2 border-amber-300">
      <Tooltip label="Duration in minutes and seconds" color="#2E2E2E">
        <div
          style={{ fontSize }}
          className="flex min-w-[90px] max-w-[90px] overflow-hidden justify-items-start text-white cursor-default"
        >
          <Digit place={10} value={minutes} />
          <Digit place={1} value={minutes} />
          <Digit place={10} value={seconds} />
          <Digit place={1} value={seconds} />
        </div>
      </Tooltip>
    </div>
  );
}

function Digit({ place, value }: { place: 1 | 10; value: number }) {
  const valueRoundedToPlace = Math.floor(value / place);
  const animatedValue = useSpring(valueRoundedToPlace);

  let additionalClasses = 'rounded-l';
  if (place === 1) {
    additionalClasses = 'rounded-r ml-[-7px] mr-2';
  }

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <div
      style={{ height }}
      className={`relative w-[1ch] tabular-nums border border-[#fff] text-[#C1C2C5] bg-[#1F1F1F] px-3 ${additionalClasses}`}
    >
      {[...Array(10).keys()].map((i) => (
        <Number key={i} mv={animatedValue} number={i} />
      ))}
    </div>
  );
}

function Number({ mv, number }: { mv: MotionValue; number: number }) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;

    let memo = offset * height;

    if (offset > 5) {
      memo -= 10 * height;
    }

    return memo;
  });

  return (
    <motion.span
      style={{ y }}
      className="absolute inset-0 flex items-center justify-center "
    >
      {number}
    </motion.span>
  );
}

export default Counter;
