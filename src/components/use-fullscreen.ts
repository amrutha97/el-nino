import { useCallback, useEffect, useState } from "react";

function needsFallback() {
  const ua = navigator.userAgent || "";
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

export function useFullscreen(getElement: () => HTMLElement | null) {
  const [active, setActive] = useState(false);
  const [fallback, setFallback] = useState(false);

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setActive(false);
    setFallback(false);
    document.documentElement.style.overflow = "";
  }, []);

  const enter = useCallback(async () => {
    const el = getElement();
    if (!el) return;
    const native = !needsFallback() && typeof el.requestFullscreen === "function";
    if (!native) {
      setFallback(true);
      setActive(true);
      document.documentElement.style.overflow = "hidden";
      return;
    }
    try {
      await el.requestFullscreen();
      setFallback(false);
      setActive(true);
    } catch {
      setFallback(true);
      setActive(true);
      document.documentElement.style.overflow = "hidden";
    }
  }, [getElement]);

  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement) return;
      setFallback((isFallback) => {
        if (isFallback) return true;
        setActive(false);
        document.documentElement.style.overflow = "";
        return false;
      });
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, exit]);

  return { active, fallback, enter, exit };
}
