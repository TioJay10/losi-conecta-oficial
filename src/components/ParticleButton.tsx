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
    timerRef.current = window.setTimeout(() => setBurst(0), 720);
  };

  const handlePointerDown = (_event: PointerEvent<HTMLSpanElement>) => {
    trigger();
  };

  return (
    <span
      className="losi-particle-button-shell"
      onPointerDown={handlePointerDown}
    >
      {burst > 0 && (
        <span key={burst} className="losi-particle-burst" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              style={{
                "--particle-angle": `${index * 20}deg`,
                "--particle-distance": `${28 + (index % 6) * 7}px`,
                "--particle-delay": `${(index % 6) * 12}ms`,
              } as CSSProperties}
            />
          ))}
        </span>
      )}
      {children}
    </span>
  );
}
