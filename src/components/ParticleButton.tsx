import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

type ParticleButtonProps = {
  children: ReactNode;
};

export function ParticleButton({ children }: ParticleButtonProps) {
  const [burst, setBurst] = useState(0);
  const timerRef = useRef<number | null>(null);

  const trigger = () => {
    setBurst((value) => value + 1);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setBurst(0), 900);
  };

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    trigger();
  };

  return (
    <span className="losi-particle-button-shell" onPointerDown={handlePointerDown}>
      {burst > 0 && (
        <span key={burst} className="losi-particle-burst" aria-hidden="true">
          {Array.from({ length: 26 }, (_, index) => (
            <i
              key={index}
              style={{
                "--particle-angle": `${index * (360 / 26)}deg`,
                "--particle-distance": `${34 + (index % 7) * 8}px`,
                "--particle-delay": `${(index % 7) * 18}ms`,
                "--particle-size": `${3 + (index % 4)}px`,
              } as CSSProperties}
            />
          ))}
        </span>
      )}
      {children}
    </span>
  );
}
