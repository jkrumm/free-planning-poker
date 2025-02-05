import { useEffect, useState } from 'react';

import {
  type MotionValue,
  motion,
  useSpring,
  useTransform,
} from 'framer-motion';

import { useRoomStore } from 'fpp/store/room.store';

const fontSize = 18;
const padding = 18;
const height = fontSize + padding;

function Counter() {
  const startedAt = useRoomStore((store) => store.startedAt);
  const isFlipped = useRoomStore((store) => store.isFlipped);

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
    <div className="mb-[19px]">
      <div
        style={{ fontSize }}
        className="flex min-w-[105px] max-w-[105px] overflow-hidden justify-items-start cursor-default"
      >
        <DigitComponent place={10} value={minutes} />
        <DigitComponent place={1} value={minutes} />
        <DigitComponent place={10} value={seconds} />
        <DigitComponent place={1} value={seconds} />
      </div>
    </div>
  );
}

function DigitComponent({
  place,
  value,
}: Readonly<{ place: 1 | 10; value: number }>) {
  const valueRoundedToPlace = Math.floor(value / place);
  const animatedValue = useSpring(valueRoundedToPlace);

  let additionalClasses = 'rounded-l';
  if (place === 1) {
    additionalClasses = 'rounded-r ml-[-2px] mr-2';
  }

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <div
      style={{ height }}
      className={`relative min-w-[25px] w-[25px] tabular-nums border border-[#424242] text-[#C1C2C5] bg-[#242424] ${additionalClasses}`}
    >
      {[...Array(10).keys()].map((i) => (
        <NumberComponent key={i} mv={animatedValue} number={i} />
      ))}
    </div>
  );
}

function NumberComponent({
  mv,
  number,
}: Readonly<{ mv: MotionValue; number: number }>) {
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
      className="absolute inset-0 flex items-center justify-center mono left-[-1px]"
    >
      {number}
    </motion.span>
  );
}

export default Counter;
