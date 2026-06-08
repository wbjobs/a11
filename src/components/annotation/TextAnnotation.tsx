import { useRef, useState, useMemo } from 'react';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { Annotation } from 'shared/types';

interface TextAnnotationProps {
  annotation: Annotation;
  isSelected: boolean;
  onClick: (annotationId: string) => void;
}

export function TextAnnotation({ annotation, isSelected, onClick }: TextAnnotationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const { position, color, size, text, userName, createdAt } = annotation;

  const displayText = text || '标注';

  const textConfig = useMemo(() => {
    const fontSize = size * 0.5;
    const padding = size * 0.3;
    const lineHeight = fontSize * 1.2;
    const textWidth = displayText.length * fontSize * 0.6;
    const textHeight = lineHeight;
    const bgWidth = textWidth + padding * 2;
    const bgHeight = textHeight + padding * 1.5;

    return {
      fontSize,
      padding,
      bgWidth,
      bgHeight,
      textOffset: -textWidth / 2,
    };
  }, [size, displayText]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  const getContrastColor = (hexColor: string): string => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  const textColor = getContrastColor(color);

  return (
    <group ref={groupRef} position={position}>
      <Billboard>
        <group
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
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[textConfig.bgWidth, textConfig.bgHeight, 1, 1]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={isSelected ? 0.5 : hovered ? 0.2 : 0}
              transparent
              opacity={0.95}
              roughness={0.3}
              metalness={0.1}
            />
          </mesh>

          {isSelected && (
            <mesh position={[0, 0, -0.02]}>
              <planeGeometry args={[textConfig.bgWidth * 1.1, textConfig.bgHeight * 1.2, 1, 1]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.3}
                side={THREE.BackSide}
              />
            </mesh>
          )}

          <Text
            position={[textConfig.textOffset, 0, 0]}
            fontSize={textConfig.fontSize}
            color={textColor}
            anchorX="left"
            anchorY="middle"
            maxWidth={textConfig.bgWidth - textConfig.padding * 2}
          >
            {displayText}
          </Text>
        </group>
      </Billboard>

      {hovered && (
        <Billboard position={[0, textConfig.bgHeight / 2 + 0.1, 0]}>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[2, 0.8, 1, 1]} />
            <meshBasicMaterial
              color="#111827"
              transparent
              opacity={0.95}
            />
          </mesh>
          <Text
            position={[-0.9, 0.15, 0]}
            fontSize={0.12}
            color="#ffffff"
            anchorX="left"
            anchorY="middle"
            fontWeight="bold"
          >
            {userName}
          </Text>
          <Text
            position={[-0.9, -0.15, 0]}
            fontSize={0.1}
            color="#9ca3af"
            anchorX="left"
            anchorY="middle"
          >
            {formatTime(createdAt)}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
