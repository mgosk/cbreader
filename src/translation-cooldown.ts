import { useEffect, useRef, useState } from "react";

export function useTranslationCooldown(timeout: number) {
  const lastReveal = useRef<number | null>(null);
  const [started, setStarted] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function update() {
      const seconds =
        started === null
          ? 0
          : Math.max(
              0,
              Math.ceil((started + timeout * 1000 - Date.now()) / 1000),
            );
      setRemaining(seconds);
      return seconds;
    }
    if (!update()) return;
    const timer = setInterval(() => {
      if (!update()) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [started, timeout]);

  function requestReveal() {
    const now = Date.now();
    if (
      lastReveal.current !== null &&
      now < lastReveal.current + timeout * 1000
    )
      return false;
    lastReveal.current = now;
    setStarted(now);
    setRemaining(timeout);
    return true;
  }

  return { remaining, requestReveal };
}
