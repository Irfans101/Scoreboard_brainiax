import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function DigitalCounter({ value, stepDelay = 60, className = "" }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(null);
  const intervalRef = useRef(null);
  const prevRef = useRef(value);
  const pulseRef = useRef(false);

  useEffect(() => {
    prevRef.current = display;
  }, [display]);

  useEffect(() => {
    if (value === display) return;

    const target = value;
    const direction = target > display ? 1 : -1;
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setDisplay((d) => {
        const next = d + direction;
        if ((direction === 1 && next >= target) || (direction === -1 && next <= target)) {
          clearInterval(intervalRef.current);
          return target;
        }
        return next;
      });
    }, stepDelay);

    return () => clearInterval(intervalRef.current);
  }, [value]);

  // trigger a brief scale pulse whenever display changes
  useEffect(() => {
    pulseRef.current = true;
    const t = setTimeout(() => (pulseRef.current = false), 220);
    return () => clearTimeout(t);
  }, [display]);

  return (
    <motion.span
      className={className}
      animate={pulseRef.current ? { scale: 1.04 } : { scale: 1 }}
      transition={{ duration: 0.18 }}
    >
      {display}
    </motion.span>
  );
}
