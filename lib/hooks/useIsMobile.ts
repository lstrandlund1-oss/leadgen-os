"use client";

import { useEffect, useState } from "react";

/**
 * Single source of truth for the phone/desktop boundary across the whole app.
 * Anything checking "is this a phone?" — layout forks, particle effects,
 * animation loops — should use this hook so the boundary is consistent
 * everywhere instead of every component picking its own breakpoint.
 *
 * 767px matches Tailwind's `md` breakpoint (768px) so this lines up with
 * any `md:` / `hidden md:block` classes used for pure-CSS layout forks.
 */
const MOBILE_BREAKPOINT_PX = 767;

export function useIsMobile(): boolean {
  // Default to false (desktop) during SSR and before the first client
  // measurement — avoids assuming "mobile" for a desktop user's very
  // first paint, since most traffic sources for this app skew desktop
  // during onboarding/demo contexts.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);

    const update = () => setIsMobile(mql.matches);
    update();

    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}
