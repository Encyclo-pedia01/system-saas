'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';

import { ScenePoster } from './scene-poster';
import { useSceneCapability } from './use-scene-capability';

// ssr: false keeps Three.js out of the server render entirely.
const LoginScene = dynamic(() => import('./login-scene'), {
  ssr: false,
  loading: () => null,
});

type BoundaryProps = { fallback: ReactNode; children: ReactNode };
type BoundaryState = { failed: boolean };

class SceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function AmbientScene() {
  const canRenderScene = useSceneCapability();

  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      {canRenderScene ? (
        <SceneErrorBoundary fallback={<ScenePoster />}>
          <LoginScene />
        </SceneErrorBoundary>
      ) : (
        <ScenePoster />
      )}
    </div>
  );
}
