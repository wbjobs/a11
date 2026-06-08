import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type ColorMode = 'original' | 'height' | 'curvature';

interface PointCloudProps {
  points: Float32Array;
  colors: Float32Array;
  pointSize?: number;
  colorMode?: ColorMode;
}

function generateHeightColors(points: Float32Array): Float32Array {
  const colors = new Float32Array(points.length);
  let minY = Infinity, maxY = -Infinity;
  
  for (let i = 1; i < points.length; i += 3) {
    minY = Math.min(minY, points[i]);
    maxY = Math.max(maxY, points[i]);
  }
  
  const range = maxY - minY || 1;
  
  for (let i = 0; i < points.length; i += 3) {
    const y = points[i + 1];
    const t = (y - minY) / range;
    colors[i] = t;
    colors[i + 1] = 0.5 * (1 - Math.abs(t - 0.5) * 2);
    colors[i + 2] = 1 - t;
  }
  
  return colors;
}

function generateCurvatureColors(points: Float32Array): Float32Array {
  const colors = new Float32Array(points.length);
  const pointCount = points.length / 3;
  const curvature = new Float32Array(pointCount);
  
  for (let i = 0; i < pointCount; i++) {
    const idx = i * 3;
    const x = points[idx], y = points[idx + 1], z = points[idx + 2];
    let sumDist = 0, count = 0;
    
    for (let j = Math.max(0, i - 20); j < Math.min(pointCount, i + 20); j++) {
      if (i === j) continue;
      const jdx = j * 3;
      const dx = x - points[jdx];
      const dy = y - points[jdx + 1];
      const dz = z - points[jdx + 2];
      sumDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
      count++;
    }
    
    curvature[i] = sumDist / (count || 1);
  }
  
  let minC = Infinity, maxC = -Infinity;
  for (let i = 0; i < pointCount; i++) {
    minC = Math.min(minC, curvature[i]);
    maxC = Math.max(maxC, curvature[i]);
  }
  
  const range = maxC - minC || 1;
  
  for (let i = 0; i < pointCount; i++) {
    const t = (curvature[i] - minC) / range;
    const idx = i * 3;
    colors[idx] = 1 - t;
    colors[idx + 1] = t * 0.8;
    colors[idx + 2] = t;
  }
  
  return colors;
}

export default function PointCloud({
  points,
  colors: originalColors,
  pointSize = 0.05,
  colorMode = 'original'
}: PointCloudProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const scaleRef = useRef(0);
  const pointCount = points.length / 3;

  const heightColors = useMemo(() => generateHeightColors(points), [points]);
  const curvatureColors = useMemo(() => generateCurvatureColors(points), [points]);

  const displayColors = useMemo(() => {
    switch (colorMode) {
      case 'height': return heightColors;
      case 'curvature': return curvatureColors;
      default: return originalColors;
    }
  }, [colorMode, heightColors, curvatureColors, originalColors]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(points, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(displayColors, 3));
    geo.computeBoundingSphere();
    return geo;
  }, [points, displayColors]);

  useEffect(() => {
    geometry.setAttribute('color', new THREE.BufferAttribute(displayColors, 3));
    geometry.attributes.color.needsUpdate = true;
  }, [displayColors, geometry]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    
    if (scaleRef.current < 1) {
      scaleRef.current = Math.min(1, scaleRef.current + delta * 2);
      const eased = 1 - Math.pow(1 - scaleRef.current, 3);
      pointsRef.current.scale.setScalar(eased);
    }
    
    pointsRef.current.matrixAutoUpdate = false;
    pointsRef.current.updateMatrix();
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      frustumCulled
      matrixAutoUpdate={false}
    >
      <pointsMaterial
        size={pointSize}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
