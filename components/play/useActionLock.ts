"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lets one action through, then ignores input until its animation has played.
 * The ref makes the check synchronous, so a double-click in one frame can't
 * slip a second pop through before React re-renders.
 */
export function useActionLock() {
  const lockedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const run = useCallback((fn: () => boolean, ms: number) => {
    if (lockedRef.current) return;
    const acted = fn();
    if (!acted || ms <= 0) return;
    lockedRef.current = true;
    setLocked(true);
    timer.current = setTimeout(() => {
      lockedRef.current = false;
      setLocked(false);
    }, ms);
  }, []);

  return { locked, run };
}
