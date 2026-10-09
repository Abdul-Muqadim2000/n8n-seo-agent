import { createContext, useContext } from 'react';

/** The surface a component sits on: `light` (page / cards, both themes), `ink` or `blue` (inside a SummaryHero). */
export type Surface = 'light' | 'ink' | 'blue';

export const SurfaceContext = createContext<Surface>('light');

/** Which surface the component is on, so rings, tips and stats can switch to on-dark colours. */
export const useSurface = () => useContext(SurfaceContext);
