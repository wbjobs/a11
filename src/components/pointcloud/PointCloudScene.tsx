import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, FXAA } from '@react-three/postprocessing';
import { useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { PointCloudData } from 'shared/types';
import PointCloud, { type ColorMode } from '@/components/pointcloud/PointCloud';
import { PointCloudControls } from '@/components/pointcloud/PointCloudControls';
import LoadingParticles from '@/components/pointcloud/LoadingParticles';

interface PointCloudSceneProps {
  pointCloud?: PointCloudData;
  loading?: boolean;
}

function SceneContent({
  pointCloud,
  loading,
  pointSize,
  colorMode,
  showAxes,
  showGrid,
  autoRotate,
  controlsRef
}: {
  pointCloud?: PointCloudData;
  loading?: boolean;
  pointSize: number;
  colorMode: ColorMode;
  showAxes: boolean;
  showGrid: boolean;
  autoRotate: boolean;
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();

  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={60} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        minDistance={0.5}
        maxDistance={100}
      />

      <fog attach="fog" args={['#0a0a1a', 10, 50]} />
      <color attach="background" args={['#0a0a1a']} />

      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />

      {showAxes && <axesHelper args={[3]} />}
      {showGrid && (
        <gridHelper args={[20, 20, '#333344', '#222233']} position={[0, -0.01, 0]} />
      )}

      {loading ? (
        <LoadingParticles />
      ) : pointCloud ? (
        <PointCloud
          points={new Float32Array(pointCloud.points)}
          colors={new Float32Array(pointCloud.colors)}
          pointSize={pointSize}
          colorMode={colorMode}
        />
      ) : null}

      <EffectComposer enableNormalPass={false}>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={0.5}
          mipmapBlur
        />
        <FXAA />
      </EffectComposer>
    </>
  );
}

export function PointCloudScene({ pointCloud, loading, children }: PointCloudSceneProps & { children?: React.ReactNode }) {
  const controlsRef = useRef<any>(null);
  const [pointSize, setPointSize] = useState(0.05);
  const [colorMode, setColorMode] = useState<ColorMode>('original');
  const [showAxes, setShowAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);

  const handleResetView = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: false }}>
        <SceneContent
          pointCloud={pointCloud}
          loading={loading}
          pointSize={pointSize}
          colorMode={colorMode}
          showAxes={showAxes}
          showGrid={showGrid}
          autoRotate={autoRotate}
          controlsRef={controlsRef}
        />
        {children}
      </Canvas>

      <PointCloudControls
        pointSize={pointSize}
        onPointSizeChange={setPointSize}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        showAxes={showAxes}
        onShowAxesChange={setShowAxes}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        autoRotate={autoRotate}
        onAutoRotateChange={setAutoRotate}
        onResetView={handleResetView}
      />
    </div>
  );
}
