export function preciseTimeout(callback: () => void, delay: number) {
  const start = Date.now();
  const checkDelay = () => {
    const now = Date.now();
    const elapsed = now - start;

    if (elapsed >= delay) {
      callback();
    } else {
      // Use setImmediate to check again immediately
      setImmediate(checkDelay);
    }
  };

  // Start checking immediately
  setImmediate(checkDelay);
}