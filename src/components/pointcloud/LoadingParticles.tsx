import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 500;

export default function LoadingParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, colors, targets } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const targets = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const radius = Math.random() * 3 + 1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      targets[i3] = radius * Math.sin(phi) * Math.cos(theta);
      targets[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      targets[i3 + 2] = radius * Math.cos(phi);

      const spreadRadius = 10;
      positions[i3] = (Math.random() - 0.5) * spreadRadius;
      positions[i3 + 1] = (Math.random() - 0.5) * spreadRadius;
      positions[i3 + 2] = (Math.random() - 0.5) * spreadRadius;

      const hue = 0.55 + Math.random() * 0.15;
      const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    return { positions, colors, targets };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    timeRef.current += delta;
    const time = timeRef.current;
    const positions = geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const progress = (Math.sin(time * 0.5 + i * 0.01) + 1) / 2;
      const eased = 1 - Math.pow(1 - progress, 3);

      const targetX = targets[i3] + Math.sin(time + i) * 0.2;
      const targetY = targets[i3 + 1] + Math.cos(time * 0.7 + i) * 0.2;
      const targetZ = targets[i3 + 2] + Math.sin(time * 1.2 + i) * 0.2;

      positions[i3] += (targetX - positions[i3]) * delta * 3 * eased;
      positions[i3 + 1] += (targetY - positions[i3 + 1]) * delta * 3 * eased;
      positions[i3 + 2] += (targetZ - positions[i3 + 2]) * delta * 3 * eased;
    }

    geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y += delta * 0.2;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.08}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
