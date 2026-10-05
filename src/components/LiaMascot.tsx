import { useId, useState } from "react";

type LiaState = "idle" | "working" | "success";

/** The hips and ankles move independently, with the two legs half a cycle apart. */
function LiaWalk() {
 const id = useId().replace(/:/g, "");
 const part = (name: string) => <image href="/lia-pavoa.webp" width="384" height="461" clipPath={`url(#${id}-${name})`} />;
 return <svg className="lia-walk-rig" viewBox="0 0 480 645" aria-hidden="true" focusable="false">
  <defs>
   <clipPath id={`${id}-body`}><path d="M0 0H384V355H0Z" /></clipPath>
   <clipPath id={`${id}-left-shin`}><path d="M150 340H183L161 418H138Z" /></clipPath>
   <clipPath id={`${id}-left-foot`}><path d="M135 406H168L190 461H110V422Z" /></clipPath>
   <clipPath id={`${id}-right-shin`}><path d="M191 340H216L234 413H211Z" /></clipPath>
   <clipPath id={`${id}-right-foot`}><path d="M210 401H239L274 435V461H202Z" /></clipPath>
  </defs>
  <g transform="translate(24 120) scale(1.08)">
   <g className="lia-walk-body">
    <g className="lia-leg lia-leg-right">
     {part("right-shin")}
     <g className="lia-foot lia-foot-right">{part("right-foot")}</g>
    </g>
    <g className="lia-leg lia-leg-left">
     {part("left-shin")}
     <g className="lia-foot lia-foot-left">{part("left-foot")}</g>
    </g>
    {part("body")}
   </g>
  </g>
 </svg>;
}

/** Decorative animation; the surrounding status text communicates progress. */
export function LiaMascot({ state = "idle", className = "" }: { state?: LiaState; className?: string }) {
 const [loaded, setLoaded] = useState(false);
 return <span className={`lia-mascot lia-${state} ${loaded ? "is-loaded" : ""} ${className}`} aria-hidden="true">
  <img className="lia-sprite-loader" src="/lia-pavoa-sprites.webp" alt="" onLoad={() => setLoaded(true)} />
  {!loaded && <img className="lia-mascot-fallback" src="/lia-pavoa.webp" alt="" width={384} height={461} />}
  {state === "working" ? <LiaWalk /> : <span className="lia-sprite" />}
 </span>;
}
