"use client";
import { useEffect, useRef, useState } from "react";
import { formatMinor } from "@/lib/money";

/** Counts up to the value, and from the old value to the new one when a sale arrives. */
export default function AnimatedNumber({ value, scale }: { value: string; scale: number }) {
  const [text, setText] = useState(() => formatMinor("0", scale));
  const prev = useRef(0);

  useEffect(() => {
    const to = Number(value);
    const from = prev.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from === to || to > 9e15) {
      setText(formatMinor(value, scale));
      prev.current = to;
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setText(p === 1 ? formatMinor(value, scale) : formatMinor(String(Math.round(from + (to - from) * eased)), scale));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, scale]);

  return <span aria-label={formatMinor(value, scale)}>{text}</span>;
}
