'use client';

import { Float, Icosahedron, MeshDistortMaterial, Sphere, TorusKnot } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

const ACCENT = '#1E5BB8';
const SOFT_BLUE = '#F2B230';
const DEEP_NAVY = '#14306A';

export default function LoginScene() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 7], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 5, 6]} intensity={1.4} color={SOFT_BLUE} />
      <pointLight position={[-4, -2, 3]} intensity={0.9} color={ACCENT} />

      <Float speed={1.2} rotationIntensity={0.9} floatIntensity={1.4}>
        <Icosahedron args={[1.3, 1]} position={[-2.7, 0.9, -1]}>
          <meshStandardMaterial color={ACCENT} wireframe />
        </Icosahedron>
      </Float>

      <Float speed={1.6} rotationIntensity={1.2} floatIntensity={1}>
        <TorusKnot args={[0.8, 0.26, 128, 16]} position={[2.9, -0.9, -0.5]}>
          <meshStandardMaterial color={SOFT_BLUE} metalness={0.4} roughness={0.25} />
        </TorusKnot>
      </Float>

      <Float speed={1} floatIntensity={1.8}>
        <Sphere args={[0.9, 64, 64]} position={[3.4, 2.4, -3]}>
          <MeshDistortMaterial color={DEEP_NAVY} distort={0.35} speed={1.5} roughness={0.2} />
        </Sphere>
      </Float>
    </Canvas>
  );
}
