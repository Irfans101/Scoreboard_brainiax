import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function AnimatedCounter({ value }) {
  const [displayValue, setDisplayValue] = useState(value);
  const tweenRef = useRef(null);

  useEffect(() => {
    const proxy = { val: displayValue };

    if (tweenRef.current) {
      tweenRef.current.kill();
    }

    tweenRef.current = gsap.to(proxy, {
      val: value,
      duration: 0.9,
      ease: "power3.out",
      onUpdate: () => {
        setDisplayValue(Math.round(proxy.val));
      }
    });

    return () => {
      if (tweenRef.current) {
        tweenRef.current.kill();
      }
    };
  }, [value]);

  return <span>{displayValue}</span>;
}
