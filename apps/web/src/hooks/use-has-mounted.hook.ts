import { useEffect, useState } from 'react';

/**
 * Hook to safely detect client-side mounting for SSR/SSG hydration
 *
 * This pattern prevents hydration mismatches between server and client rendering
 * by deferring client-specific logic until after the component has mounted.
 *
 * @see https://www.joshwcomeau.com/react/the-perils-of-rehydration/
 * @see https://github.com/facebook/react/issues/34743 - Valid use case for setState in effect
 *
 * @returns boolean - false during SSR/initial render, true after client-side mount
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const hasMounted = useHasMounted();
 *
 *   if (!hasMounted) {
 *     return <div>Loading...</div>; // SSR-safe fallback
 *   }
 *
 *   // Client-only code (localStorage, window, etc.)
 *   const user = localStorage.getItem('user');
 *   return <div>Welcome {user}</div>;
 * }
 * ```
 */
export function useHasMounted(): boolean {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid hydration safety pattern for Next.js SSR/SSG
    setHasMounted(true);
  }, []);

  return hasMounted;
}
