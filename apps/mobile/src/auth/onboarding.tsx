import { createContext, type ReactNode, use, useMemo, useRef, useState } from 'react';

type Onboarding = {
  /** True from creating a profile until the last sign-up step is done. */
  active: boolean;
  begin: () => void;
  /** Ends sign-up and opens the app. "then" is a screen to open straight after, such as starting a journey. */
  finish: (then?: string) => void;
  /** The screen asked for by finish(), handed over once. */
  takeNext: () => string | null;
};

const OnboardingContext = createContext<Onboarding | null>(null);

/** Remembers that a new person is still in the sign-up steps, so the app doesn't open Home half way through. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const next = useRef<string | null>(null);
  const value = useMemo<Onboarding>(
    () => ({
      active,
      begin: () => setActive(true),
      finish: (then) => {
        next.current = then ?? null;
        setActive(false);
      },
      takeNext: () => {
        const href = next.current;
        next.current = null;
        return href;
      },
    }),
    [active],
  );
  return <OnboardingContext value={value}>{children}</OnboardingContext>;
}

export function useOnboarding(): Onboarding {
  const value = use(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return value;
}
