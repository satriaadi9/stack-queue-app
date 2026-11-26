"use client";

import { MotionConfig } from "motion/react";
import { createContext, useContext, useEffect, useState } from "react";
import { useGame } from "@/lib/store";

const Hydrated = createContext(false);
/** False until localStorage has been read. Gate any UI that depends on saved state. */
export const useHydrated = () => useContext(Hydrated);

export function Providers({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void Promise.resolve(useGame.persist.rehydrate()).then(() => {
      // A shared link ?deck=CODE loads a house deck, then the URL is cleaned up.
      const url = new URL(window.location.href);
      const code = url.searchParams.get("deck");
      if (code) {
        useGame.getState().setDeck(code);
        url.searchParams.delete("deck");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
      setHydrated(true);
    });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Hydrated.Provider value={hydrated}>{children}</Hydrated.Provider>
    </MotionConfig>
  );
}
