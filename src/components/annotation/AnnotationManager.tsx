import { useRef, useCallback, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ArrowAnnotation } from './ArrowAnnotation';
import { SphereAnnotation } from './SphereAnnotation';
import { TextAnnotation } from './TextAnnotation';
import type { Annotation, AnnotationType } from 'shared/types';
import { useAppStore } from '../../store/useAppStore';
import type { SelectedTool } from '../../store/useAppStore';

interface AnnotationManagerProps {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  selectedTool: SelectedTool;
  onAddAnnotation?: (annotation: any) => void;
}

export function AnnotationManager({ annotations, selectedAnnotationId, selectedTool, onAddAnnotation }: AnnotationManagerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, camera, raycaster, pointer } = useThree();

  const selectAnnotation = useAppStore((state) => state.selectAnnotation);
  const currentUser = useAppStore((state) => state.currentUser);
  const currentPointCloud = useAppStore((state) => state.currentPointCloud);

  const handleAnnotationClick = useCallback((annotationId: string) => {
    selectAnnotation(annotationId === selectedAnnotationId ? null : annotationId);
  }, [selectedAnnotationId, selectAnnotation]);

  const getAnnotationTypeFromTool = (tool: string): AnnotationType | null => {
    switch (tool) {
      case 'annotate-arrow':
        return 'arrow';
      case 'annotate-sphere':
        return 'sphere';
      case 'annotate-text':
        return 'text';
      default:
        return null;
    }
  };

  const handleSceneClick = useCallback(() => {
    const annotationType = getAnnotationTypeFromTool(selectedTool);
    if (!annotationType || !onAddAnnotation || !currentUser || !currentPointCloud) return;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      const position: [number, number, number] = [point.x, point.y, point.z];

      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      const direction: [number, number, number] = [
        cameraDirection.x,
        cameraDirection.y,
        cameraDirection.z,
      ];

      onAddAnnotation({
        type: annotationType,
        position,
        direction: annotationType === 'arrow' ? direction : undefined,
        color: '#ff5500',
        size: 0.5,
        text: annotationType === 'text' ? '新标注' : undefined,
      });
    }
  }, [selectedTool, onAddAnnotation, currentUser, currentPointCloud, raycaster, pointer, camera, scene]);

  useEffect(() => {
    const annotationType = getAnnotationTypeFromTool(selectedTool);
    if (annotationType) {
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = 'auto';
    }
  }, [selectedTool]);

  const renderAnnotation = (annotation: Annotation) => {
    const isSelected = annotation.annotationId === selectedAnnotationId;

    switch (annotation.type) {
      case 'arrow':
        return (
          <ArrowAnnotation
            key={annotation.annotationId}
            annotation={annotation}
            isSelected={isSelected}
            onClick={handleAnnotationClick}
          />
        );
      case 'sphere':
        return (
          <SphereAnnotation
            key={annotation.annotationId}
            annotation={annotation}
            isSelected={isSelected}
            onClick={handleAnnotationClick}
          />
        );
      case 'text':
        return (
          <TextAnnotation
            key={annotation.annotationId}
            annotation={annotation}
            isSelected={isSelected}
            onClick={handleAnnotationClick}
          />
        );
      default:
        return null;
    }
  };

  return (
    <group ref={groupRef} onClick={handleSceneClick}>
      {annotations.map(renderAnnotation)}
    </group>
  );
}
