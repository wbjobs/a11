import { useRef, useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Annotation } from 'shared/types';

interface ArrowAnnotationProps {
  annotation: Annotation;
  isSelected: boolean;
  onClick: (annotationId: string) => void;
}

export function ArrowAnnotation({ annotation, isSelected, onClick }: ArrowAnnotationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const { position, direction, color, size } = annotation;

  const arrowConfig = useMemo(() => {
    const arrowLength = size;
    const shaftRadius = size * 0.1;
    const headRadius = size * 0.25;
    const headLength = size * 0.4;

    const dir = direction
      ? new THREE.Vector3(...direction).normalize()
      : new THREE.Vector3(0, 1, 0);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    const shaftPosition = dir.clone().multiplyScalar(arrowLength * 0.5 - headLength * 0.5);
    const headPosition = dir.clone().multiplyScalar(arrowLength - headLength * 0.5);

    return {
      arrowLength,
      shaftRadius,
      headRadius,
      headLength,
      quaternion,
      shaftPosition: [shaftPosition.x, shaftPosition.y, shaftPosition.z] as [number, number, number],
      headPosition: [headPosition.x, headPosition.y, headPosition.z] as [number, number, number],
    };
  }, [direction, size]);

  const emissiveIntensity = isSelected ? 0.8 : hovered ? 0.3 : 0;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  return (
    <group
      ref={groupRef}
      position={position}
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
      <group quaternion={arrowConfig.quaternion}>
        <mesh position={arrowConfig.shaftPosition}>
          <cylinderGeometry
            args={[arrowConfig.shaftRadius, arrowConfig.shaftRadius, arrowConfig.arrowLength - arrowConfig.headLength, 16]}
          />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emissiveIntensity}
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
        <mesh position={arrowConfig.headPosition}>
          <coneGeometry
            args={[arrowConfig.headRadius, arrowConfig.headLength, 16]}
          />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emissiveIntensity}
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
      </group>

      {isSelected && (
        <group quaternion={arrowConfig.quaternion}>
          <mesh position={arrowConfig.shaftPosition}>
            <cylinderGeometry
              args={[arrowConfig.shaftRadius * 1.3, arrowConfig.shaftRadius * 1.3, arrowConfig.arrowLength - arrowConfig.headLength, 16]}
            />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.3}
              side={THREE.BackSide}
            />
          </mesh>
          <mesh position={arrowConfig.headPosition}>
            <coneGeometry
              args={[arrowConfig.headRadius * 1.3, arrowConfig.headLength * 1.3, 16]}
            />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.3}
              side={THREE.BackSide}
            />
          </mesh>
        </group>
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
