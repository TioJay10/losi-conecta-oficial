import { useState } from "react";

type LiaState = "idle" | "working" | "success";

/** Decorative animation; the surrounding status text communicates progress. */
export function LiaMascot({ state = "idle", className = "" }: { state?: LiaState; className?: string }) {
 const [loaded, setLoaded] = useState(false);
 return <span className={`lia-mascot lia-${state} ${loaded ? "is-loaded" : ""} ${className}`} aria-hidden="true">
  <img className="lia-sprite-loader" src="/lia-pavoa-sprites.webp" alt="" onLoad={() => setLoaded(true)} />
  {!loaded && <img className="lia-mascot-fallback" src="/lia-pavoa.webp" alt="" width={384} height={461} />}
  <span className="lia-sprite" />
 </span>;
}
