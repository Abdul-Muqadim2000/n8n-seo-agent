import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

// The 33 rays of the supplied Alaventra mark (public/brand/alaventra-mark-*.svg), split out of its single path unchanged, same
// coordinates, same viewBox, nothing redrawn. Path order runs from the short ray on the right, round the "rising sun" at the
// bottom, up to the longest ray at the wing tip, so a wave in this order travels from the sun into the wing.
const VIEW_BOX = '-623.18 -603.40 911.07 796.53';
const RAYS = [
  "M95.91 -28.41 283.88 -84.09 287.89 -69.12 97.27 -23.35Z",
  "M98.80 -15.65 209.73 -33.22 211.18 -22.20 99.49 -10.46Z",
  "M100.00 -2.62 181.66 -4.76 181.66 4.76 100.00 2.62Z",
  "M99.49 10.46 180.72 18.99 179.48 28.43 98.80 15.65Z",
  "M97.27 23.35 160.48 38.53 158.25 46.87 95.91 28.41Z",
  "M93.39 35.85 154.08 59.15 150.78 67.13 91.39 40.69Z",
  "M87.91 47.73 132.68 72.04 128.72 78.88 85.29 52.27Z",
  "M80.93 58.80 122.14 88.74 117.33 95.01 77.74 62.95Z",
  "M72.56 68.86 109.51 103.92 103.92 109.51 68.86 72.56Z",
  "M62.95 77.74 95.01 117.33 88.74 122.14 58.80 80.93Z",
  "M52.27 85.29 78.88 128.72 72.04 132.68 47.73 87.91Z",
  "M40.69 91.39 61.41 137.92 54.10 140.94 35.85 93.39Z",
  "M28.41 95.91 42.88 144.75 35.24 146.80 23.35 97.27Z",
  "M15.65 98.80 23.62 149.11 15.78 150.14 10.46 99.49Z",
  "M2.62 100.00 3.95 150.92 -3.95 150.92 -2.62 100.00Z",
  "M-10.46 99.49 -15.78 150.14 -23.62 149.11 -15.65 98.80Z",
  "M-23.35 97.27 -35.24 146.80 -42.88 144.75 -28.41 95.91Z",
  "M-35.85 93.39 -59.15 154.08 -67.13 150.78 -40.69 91.39Z",
  "M-47.73 87.91 -78.75 145.04 -86.24 140.72 -52.27 85.29Z",
  "M-58.80 80.93 -106.81 147.01 -114.36 141.22 -62.95 77.74Z",
  "M-68.86 72.56 -125.09 131.82 -131.82 125.09 -72.56 68.86Z",
  "M-77.74 62.95 -165.02 133.63 -171.79 124.81 -80.93 58.80Z",
  "M-85.29 52.27 -252.44 154.70 -260.19 141.27 -87.91 47.73Z",
  "M-91.39 40.69 -433.78 193.13 -443.29 170.16 -93.39 35.85Z",
  "M-95.91 28.41 -589.02 174.48 -597.34 143.41 -97.27 23.35Z",
  "M-98.80 15.65 -179.48 28.43 -180.72 18.99 -99.49 10.46Z",
  "M-100.00 2.62 -212.27 5.56 -212.27 -5.56 -100.00 -2.62Z",
  "M-99.49 -10.46 -344.29 -36.19 -341.93 -54.16 -98.80 -15.65Z",
  "M-97.27 -23.35 -461.71 -110.85 -455.28 -134.86 -95.91 -28.41Z",
  "M-93.39 -35.85 -542.11 -208.10 -530.48 -236.19 -91.39 -40.69Z",
  "M-87.91 -47.73 -603.36 -327.60 -585.39 -358.73 -85.29 -52.27Z",
  "M-80.93 -58.80 -623.18 -452.76 -598.63 -484.76 -77.74 -62.95Z",
  "M-72.56 -68.86 -603.40 -572.60 -572.60 -603.40 -68.86 -72.56Z",
];

/** wave speeds: `loader` a quick light run for loading states; `ambient` a slow, soft sweep for large faint marks */
const MOTION: Record<'loader' | 'ambient', CSSProperties> = {
  loader: { ['--alv-ray-dur' as string]: '1.6s', ['--alv-ray-step' as string]: '40ms', ['--alv-ray-rest' as string]: 0.4 },
  ambient: { ['--alv-ray-anim' as string]: 'alv-ray-soft', ['--alv-ray-dur' as string]: '9s', ['--alv-ray-step' as string]: '120ms', ['--alv-ray-rest' as string]: 0.32 },
};

/**
 * The Alaventra mark drawn from the supplied path in `currentColor` (set the colour with a text class: blue or ink on light, white on
 * ink, never per ray). With `wave`, a band of light travels along the rays from the sun to the wing tip; geometry never moves, and
 * under prefers-reduced-motion it is the plain mark. Decorative by default; pass `label` to make it an image.
 */
export function AlaventraMark({ wave, label, className, style }: { wave?: 'loader' | 'ambient'; label?: string; className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      fill="currentColor"
      className={cn('block aspect-[911/797] h-auto', wave && 'alv-mark-wave', className)}
      style={{ ...(wave ? MOTION[wave] : null), ...style }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {RAYS.map((d, i) => (
        <path key={i} d={d} className={wave ? 'alv-mark-ray' : undefined} style={wave ? { ['--i' as string]: i } : undefined} />
      ))}
    </svg>
  );
}
