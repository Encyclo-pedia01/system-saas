'use client';

import { useEffect, useState } from 'react';

const WIDE_VIEWPORT_QUERY = '(min-width: 768px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// Returns false on the server and on the first client render, so the 3D canvas
// never participates in hydration. It turns on only when the device can afford it.
export function useSceneCapability(): boolean {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia(WIDE_VIEWPORT_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const evaluate = () => setCapable(wide.matches && !reducedMotion.matches && supportsWebGL());

    evaluate();
    wide.addEventListener('change', evaluate);
    reducedMotion.addEventListener('change', evaluate);

    return () => {
      wide.removeEventListener('change', evaluate);
      reducedMotion.removeEventListener('change', evaluate);
    };
  }, []);

  return capable;
}
