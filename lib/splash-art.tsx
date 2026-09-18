/**
 * A small set of original, generic "event anchor" illustrations used on the
 * splash screen. These are flat vector silhouettes -- not photos, and not
 * any real person -- so a genuinely different pose + color story can greet
 * Vaishnavi each time she opens the app, the way the reference design
 * shows a rotating illustration on its splash screen.
 *
 * Each entry pairs a `pose` (an actual different silhouette -- back view
 * with a mic, side profile holding a tablet, arm raised mid-performance,
 * off-shoulder gown) with its own gradient + accent color, so the variety
 * is real, not just a recolor of one fixed shape.
 */

export type SplashPose = "ponytailMic" | "tabletHost" | "raisedArm" | "offShoulderGown";

export interface SplashArt {
  id: string;
  pose: SplashPose;
  gradientFrom: string;
  gradientTo: string;
  accent: string;
  hair: string;
  skin: string;
  outfit: string;
}

export const SPLASH_ARTS: SplashArt[] = [
  { id: "rose", pose: "ponytailMic", gradientFrom: "#FBD5E4", gradientTo: "#F5A8C4", accent: "#E85D8A", hair: "#3B2A33", skin: "#F3C7A8", outfit: "#3B2A33" },
  { id: "lavender", pose: "offShoulderGown", gradientFrom: "#E3DAF7", gradientTo: "#C6B4EE", accent: "#8B6FD1", hair: "#3B2A33", skin: "#F3C7A8", outfit: "#5B4B87" },
  { id: "gold", pose: "raisedArm", gradientFrom: "#FCE7C8", gradientTo: "#F6C87B", accent: "#D99A2B", hair: "#4A2E22", skin: "#EFC09B", outfit: "#B9772E" },
  { id: "sky", pose: "tabletHost", gradientFrom: "#D6EBF9", gradientTo: "#A9D6F0", accent: "#3E9BD6", hair: "#3B2A33", skin: "#F3C7A8", outfit: "#F6F1E9" },
  { id: "coral", pose: "ponytailMic", gradientFrom: "#FFE1D6", gradientTo: "#FFB49B", accent: "#E9633B", hair: "#4A2E22", skin: "#EFC09B", outfit: "#7A3B33" },
  { id: "berry", pose: "offShoulderGown", gradientFrom: "#F5D9E8", gradientTo: "#DFA6C4", accent: "#B23A6B", hair: "#241A1E", skin: "#E8B48F", outfit: "#241A1E" },
];

function Backdrop({ art }: { art: SplashArt }) {
  const gradId = `grad-${art.id}`;
  const glowId = `glow-${art.id}`;
  return (
    <>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor={art.gradientFrom} />
          <stop offset="100%" stopColor={art.gradientTo} />
        </radialGradient>
        <radialGradient id={glowId} cx="50%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="110" r="108" fill={`url(#${gradId})`} />
      <circle cx="120" cy="90" r="95" fill={`url(#${glowId})`} />
      <g fill={art.accent} opacity="0.85">
        <path d="M40 60 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z" />
        <path d="M200 150 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" />
        <path d="M195 55 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 z" />
      </g>
    </>
  );
}

/** Pose 1: back view, ponytail, mic raised toward the crowd. */
function PoseponytailMic({ art }: { art: SplashArt }) {
  return (
    <>
      <path d="M60 280 C60 210 85 182 120 182 C155 182 180 210 180 280 Z" fill={art.outfit} opacity="0.9" />
      <rect x="108" y="150" width="24" height="30" rx="10" fill={art.skin} />
      <circle cx="120" cy="120" r="38" fill={art.skin} />
      <path d="M82 118 C78 82 96 56 120 56 C144 56 162 82 158 118 C158 90 144 108 138 96 C132 108 112 108 104 98 C100 110 90 108 86 122 Z" fill={art.hair} />
      <path d="M118 118 C104 150 108 182 118 212 C122 182 126 150 124 118 Z" fill={art.hair} />
      <g transform="translate(120,150) rotate(-18)">
        <rect x="-7" y="-34" width="14" height="34" rx="7" fill="#5B4654" />
        <rect x="-9" y="-40" width="18" height="20" rx="9" fill={art.accent} />
        <rect x="-2.5" y="0" width="5" height="26" rx="2.5" fill="#5B4654" />
      </g>
    </>
  );
}

/** Pose 2: three-quarter side profile, holding a tablet/clipboard like a host. */
function PosetabletHost({ art }: { art: SplashArt }) {
  return (
    <>
      <path d="M58 280 C56 208 82 178 122 178 C158 178 182 208 182 280 Z" fill={art.outfit} opacity="0.95" />
      <rect x="104" y="150" width="24" height="28" rx="10" fill={art.skin} />
      <ellipse cx="122" cy="118" rx="34" ry="38" fill={art.skin} />
      <path d="M154 116 q10 4 4 14 q-6 4 -12 -2 Z" fill={art.skin} />
      <path d="M92 96 C90 66 106 50 126 52 C150 54 162 78 156 104 C150 88 140 72 122 70 C106 68 96 78 92 96 Z" fill={art.hair} />
      <path d="M156 100 C168 108 170 128 160 140 C164 122 158 108 148 100 Z" fill={art.hair} />
      <g transform="translate(150,192) rotate(8)">
        <rect x="-16" y="-22" width="34" height="46" rx="4" fill="#2C2430" />
        <rect x="-12" y="-17" width="26" height="34" rx="1.5" fill={art.accent} opacity="0.35" />
      </g>
      <g transform="translate(82,196) rotate(10)">
        <rect x="-6" y="-4" width="12" height="26" rx="6" fill="#5B4654" />
        <rect x="-8" y="-14" width="16" height="18" rx="8" fill={art.accent} />
      </g>
    </>
  );
}

/** Pose 3: front-facing, one arm raised mid-performance. */
function PoseraisedArm({ art }: { art: SplashArt }) {
  return (
    <>
      <path d="M62 280 C60 214 84 184 120 184 C156 184 180 214 180 280 Z" fill={art.outfit} opacity="0.92" />
      <rect x="108" y="152" width="24" height="30" rx="10" fill={art.skin} />
      <circle cx="120" cy="122" r="37" fill={art.skin} />
      <path d="M84 118 C80 84 98 58 120 58 C142 58 160 84 156 118 C154 94 142 106 132 100 C126 112 108 110 100 100 C94 108 86 106 84 118 Z" fill={art.hair} />
      <path d="M86 116 C82 148 90 174 98 188 C92 160 90 136 92 118 Z" fill={art.hair} />
      <path d="M154 196 C170 184 182 160 180 138 C178 132 170 132 168 140 C168 158 158 176 146 186 Z" fill={art.outfit} />
      <circle cx="180" cy="134" r="9" fill={art.skin} />
      <g transform="translate(96,214) rotate(-10)">
        <rect x="-6" y="-2" width="12" height="24" rx="6" fill="#5B4654" />
        <rect x="-8" y="-12" width="16" height="18" rx="8" fill={art.accent} />
      </g>
    </>
  );
}

/** Pose 4: back view, off-shoulder gown, low bun. */
function PoseoffShoulderGown({ art }: { art: SplashArt }) {
  return (
    <>
      <path d="M56 280 C54 202 82 176 120 176 C158 176 186 202 184 280 Z" fill={art.outfit} />
      <path d="M86 192 C100 200 140 200 154 192 L156 206 C138 214 102 214 84 206 Z" fill={art.skin} opacity="0.9" />
      <rect x="108" y="148" width="24" height="30" rx="10" fill={art.skin} />
      <circle cx="120" cy="118" r="37" fill={art.skin} />
      <path d="M86 112 C82 80 98 54 120 54 C142 54 158 80 154 112 C150 92 138 100 128 92 C122 102 104 100 96 90 C92 100 88 100 86 112 Z" fill={art.hair} />
      <circle cx="120" cy="140" r="14" fill={art.hair} />
      <g transform="translate(118,150) rotate(-10)">
        <rect x="-6" y="-30" width="12" height="30" rx="6" fill="#5B4654" />
        <rect x="-8" y="-36" width="16" height="18" rx="8" fill={art.accent} />
      </g>
    </>
  );
}

const POSES: Record<SplashPose, (props: { art: SplashArt }) => React.ReactElement> = {
  ponytailMic: PoseponytailMic,
  tabletHost: PosetabletHost,
  raisedArm: PoseraisedArm,
  offShoulderGown: PoseoffShoulderGown,
};

/**
 * Renders one splash illustration. Fully fluid: sized by its wrapping
 * className (see splash-screen.tsx) rather than fixed pixels, so it scales
 * cleanly from small phones up through tablets, laptops, and desktop
 * monitors while keeping its 240:280 aspect ratio.
 */
export function SplashArtSvg({ art, className }: { art: SplashArt; className?: string }) {
  const Pose = POSES[art.pose];
  return (
    <svg
      viewBox="0 0 240 280"
      className={className ?? "h-auto w-40 sm:w-52 md:w-64 lg:w-72 xl:w-80"}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Event anchor illustration"
    >
      <Backdrop art={art} />
      <Pose art={art} />
      <path
        d="M170 190 c-8 -8 -20 -2 -20 8 c0 9 12 17 20 24 c8 -7 20 -15 20 -24 c0 -10 -12 -16 -20 -8 Z"
        fill={art.accent}
        opacity="0.9"
      />
    </svg>
  );
}
