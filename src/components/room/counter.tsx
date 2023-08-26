import {
  motion,
  type MotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useState } from "react";
import { useWsStore } from "fpp/store/ws.store";

const fontSize = 18;
const padding = 18;
const height = fontSize + padding;

function Counter() {
  const voteStarted = useWsStore((store) => store.voteStarted);
  const flipped = useWsStore((store) => store.flipped);

  const [counter, setCounter] = useState(voteStarted ?? Date.now());

  useEffect(() => {
    setCounter((Date.now() - voteStarted) / 1000);
    const timer = setInterval(() => {
      if (flipped) {
        setCounter((Date.now() - voteStarted) / 1000);
      }
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [voteStarted, flipped]);

  return (
    <div className="mb-3 border-2 border-amber-300">
      <div
        style={{ fontSize }}
        className="flex min-w-[65px] max-w-[65px] space-x-2 overflow-hidden rounded border border-[#fff] bg-[#25262B] px-2 leading-none text-white"
      >
        <Digit place={100} value={counter} />
        <Digit place={10} value={counter} />
        <Digit place={1} value={counter} />
      </div>
    </div>
  );
}

function Digit({ place, value }: { place: number; value: number }) {
  const valueRoundedToPlace = Math.floor(value / place);
  const animatedValue = useSpring(valueRoundedToPlace);

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <div
      style={{ height }}
      className="relative w-[1ch] tabular-nums text-[#C1C2C5]"
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
