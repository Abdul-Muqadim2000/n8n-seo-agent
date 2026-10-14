import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { GuideVars } from '@seo/shared/guides';
import type { GuideFinish, GuideState } from './GuidePanel';

// One panel for the whole app: any component can ask for a guide by id, with the real values of the website it is talking about.
// The panel itself is a separate chunk — nothing of it is loaded until someone asks for help.

const GuidePanel = lazy(() => import('./GuidePanel'));

export interface OpenGuide {
  id: string;
  /** the real domain, record, key file… that the guide shows (falls back to its examples) */
  vars?: GuideVars;
  /** the button at the end that carries on in the app, e.g. "Check now" */
  finish?: GuideFinish;
}

export interface GuideApi {
  open: (guide: OpenGuide) => void;
  /** the searchable list of every guide */
  openIndex: () => void;
  close: () => void;
}

const Ctx = createContext<GuideApi | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuideState>(null);
  // kept mounted after the first open so closing keeps its animation
  const [mounted, setMounted] = useState(false);

  const open = useCallback((g: OpenGuide) => {
    setMounted(true);
    setState({ mode: 'guide', id: g.id, vars: g.vars, finish: g.finish });
  }, []);
  const openIndex = useCallback(() => {
    setMounted(true);
    setState({ mode: 'index' });
  }, []);
  const close = useCallback(() => setState(null), []);
  const api = useMemo<GuideApi>(() => ({ open, openIndex, close }), [open, openIndex, close]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          <GuidePanel state={state} setState={setState} close={close} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}

export function useGuides(): GuideApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useGuides needs a <GuideProvider> above it (it wraps the whole app in main.tsx)');
  return api;
}
