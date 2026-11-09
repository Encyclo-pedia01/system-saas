// Static stand-in for the 3D scene. Rendered on the server, on small screens,
// when reduced motion is requested, and whenever WebGL fails.
export function ScenePoster() {
  return (
    <div className="scene-poster absolute inset-0 overflow-hidden" aria-hidden="true" />
  );
}
