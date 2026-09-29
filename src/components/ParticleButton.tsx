import { cloneElement, useRef, useState, type CSSProperties, type MouseEvent, type ReactElement } from "react";

type ParticleButtonProps = {
  children: ReactElement<{
    className?: string;
    onClick?: (event: MouseEvent) => void;
  }>;
};

export function ParticleButton({ children }: ParticleButtonProps) {
  const [burst, setBurst] = useState(0);
  const timerRef = useRef<number | null>(null);

  const trigger = () => {
    setBurst((value) => value + 1);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setBurst(0), 650);
  };

  const child = cloneElement(children, {
    className: `${children.props.className ?? ""} losi-particle-button`.trim(),
    onClick: (event: MouseEvent) => {
      trigger();
      children.props.onClick?.(event);
    },
  });

  return (
    <span className="losi-particle-button-shell">
      {burst > 0 && (
        <span key={burst} className="losi-particle-burst" aria-hidden="true">
          {Array.from({ length: 14 }, (_, index) => (
            <i
              key={index}
              style={{
                "--particle-angle": `${index * (360 / 14)}deg`,
                "--particle-distance": `${24 + (index % 4) * 9}px`,
                "--particle-delay": `${(index % 5) * 18}ms`,
              } as CSSProperties}
            />
          ))}
        </span>
      )}
      {child}
    </span>
  );
}
