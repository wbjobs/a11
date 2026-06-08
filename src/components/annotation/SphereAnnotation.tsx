import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Annotation } from 'shared/types';

interface SphereAnnotationProps {
  annotation: Annotation;
  isSelected: boolean;
  onClick: (annotationId: string) => void;
}

export function SphereAnnotation({ annotation, isSelected, onClick }: SphereAnnotationProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const { position, color, size } = annotation;

  const emissiveIntensity = isSelected ? 0.8 : hovered ? 0.3 : 0;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(annotation.annotationId);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[size * 0.5, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.5}
          metalness={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>

      {isSelected && (
        <mesh>
          <sphereGeometry args={[size * 0.65, 32, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {hovered && (
        <Html center distanceFactor={10}>
          <div className="bg-gray-900/95 text-white px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap border border-gray-700">
            <div className="font-semibold">{annotation.userName}</div>
            <div className="text-gray-400 text-xs mt-1">
              {formatTime(annotation.createdAt)}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
