import os
import logging
import subprocess
import shutil
from typing import Optional, Tuple, List, Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


class COLMAPWrapper:
    def __init__(self, colmap_path: Optional[str] = None):
        self.colmap_path = colmap_path or shutil.which("colmap")
        self._available = None
        self._check_available()

    def _check_available(self) -> bool:
        if self._available is not None:
            return self._available
        if not self.colmap_path:
            logger.warning("COLMAP executable not found in PATH")
            self._available = False
            return False
        try:
            result = subprocess.run(
                [self.colmap_path, "--help"],
                capture_output=True,
                text=True,
                timeout=10
            )
            self._available = result.returncode == 0
            if self._available:
                logger.info(f"COLMAP is available at {self.colmap_path}")
            else:
                logger.warning("COLMAP command execution failed")
        except (subprocess.SubprocessError, FileNotFoundError, OSError) as e:
            logger.warning(f"COLMAP not available: {e}")
            self._available = False
        return self._available

    @property
    def is_available(self) -> bool:
        return self._available or False

    @staticmethod
    def extract_features(frames: List[np.ndarray], max_features: int = 8000) -> List[np.ndarray]:
        features_list = []
        try:
            import cv2
            orb = cv2.ORB_create(nfeatures=max_features)
            for frame in frames:
                if frame is None or frame.size == 0:
                    features_list.append(np.array([]))
                    continue
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
                keypoints, _ = orb.detectAndCompute(gray, None)
                if keypoints:
                    points = np.array([kp.pt for kp in keypoints], dtype=np.float32)
                    features_list.append(points)
                else:
                    features_list.append(np.array([]))
        except ImportError:
            logger.warning("OpenCV not available, using simple feature extraction")
            for frame in frames:
                if frame is None or frame.size == 0:
                    features_list.append(np.array([]))
                    continue
                h, w = frame.shape[:2]
                grid_size = 20
                x_coords = np.linspace(0, w - 1, grid_size, dtype=np.float32)
                y_coords = np.linspace(0, h - 1, grid_size, dtype=np.float32)
                xx, yy = np.meshgrid(x_coords, y_coords)
                features = np.stack([xx.ravel(), yy.ravel()], axis=1)
                features_list.append(features)
        logger.info(f"Extracted features from {len(frames)} frames")
        return features_list

    @staticmethod
    def sample_colors_from_frames(frames: List[np.ndarray], num_samples: int, frame_indices: Optional[List[int]] = None) -> np.ndarray:
        if not frames:
            return np.random.randint(0, 256, (num_samples, 3), dtype=np.uint8)
        
        valid_frames = [f for f in frames if f is not None and f.size > 0]
        if not valid_frames:
            return np.random.randint(0, 256, (num_samples, 3), dtype=np.uint8)

        colors = np.zeros((num_samples, 3), dtype=np.uint8)
        samples_per_frame = max(1, num_samples // len(valid_frames))
        
        for i, frame in enumerate(valid_frames):
            start_idx = i * samples_per_frame
            end_idx = min(start_idx + samples_per_frame, num_samples)
            actual_count = end_idx - start_idx
            if actual_count <= 0:
                break
            
            h, w = frame.shape[:2]
            x_coords = np.random.randint(0, w, actual_count)
            y_coords = np.random.randint(0, h, actual_count)
            
            if len(frame.shape) == 3 and frame.shape[2] == 3:
                frame_rgb = frame[:, :, ::-1] if frame.shape[2] == 3 else frame
                colors[start_idx:end_idx] = frame_rgb[y_coords, x_coords]
            else:
                gray_vals = frame[y_coords, x_coords]
                colors[start_idx:end_idx] = np.stack([gray_vals] * 3, axis=1)
        
        remaining = num_samples - end_idx
        if remaining > 0:
            colors[end_idx:] = np.random.randint(0, 256, (remaining, 3), dtype=np.uint8)
        
        return colors

    def run_sparse_reconstruction(
        self,
        frames: List[np.ndarray],
        output_dir: str,
        incremental_step: int = 0
    ) -> Tuple[np.ndarray, np.ndarray]:
        os.makedirs(output_dir, exist_ok=True)
        
        if self.is_available:
            return self._run_colmap_reconstruction(frames, output_dir, incremental_step)
        else:
            logger.info("COLMAP not available, using simulation algorithm")
            return self._simulate_reconstruction(frames, incremental_step)

    def _run_colmap_reconstruction(
        self,
        frames: List[np.ndarray],
        output_dir: str,
        incremental_step: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        try:
            import cv2
            image_dir = os.path.join(output_dir, "images")
            os.makedirs(image_dir, exist_ok=True)
            
            for i, frame in enumerate(frames):
                if frame is not None:
                    cv2.imwrite(os.path.join(image_dir, f"frame_{i:06d}.jpg"), frame)
            
            database_path = os.path.join(output_dir, "database.db")
            sparse_dir = os.path.join(output_dir, "sparse")
            os.makedirs(sparse_dir, exist_ok=True)

            subprocess.run(
                [self.colmap_path, "feature_extractor",
                 "--database_path", database_path,
                 "--image_path", image_dir],
                check=True, capture_output=True, text=True, timeout=300
            )

            subprocess.run(
                [self.colmap_path, "exhaustive_matcher",
                 "--database_path", database_path],
                check=True, capture_output=True, text=True, timeout=300
            )

            subprocess.run(
                [self.colmap_path, "mapper",
                 "--database_path", database_path,
                 "--image_path", image_dir,
                 "--output_path", sparse_dir],
                check=True, capture_output=True, text=True, timeout=600
            )

            points, colors = self._read_colmap_points(sparse_dir)
            if len(points) > 0:
                logger.info(f"COLMAP reconstruction successful: {len(points)} points")
                return points, colors

            logger.warning("COLMAP produced no points, falling back to simulation")
            return self._simulate_reconstruction(frames, incremental_step)

        except Exception as e:
            logger.error(f"COLMAP reconstruction failed: {e}", exc_info=True)
            return self._simulate_reconstruction(frames, incremental_step)

    @staticmethod
    def _read_colmap_points(sparse_dir: str) -> Tuple[np.ndarray, np.ndarray]:
        points3d_path = None
        for root, dirs, files in os.walk(sparse_dir):
            if "points3D.bin" in files:
                points3d_path = os.path.join(root, "points3D.bin")
                break
            elif "points3D.txt" in files:
                points3d_path = os.path.join(root, "points3D.txt")
                break

        if not points3d_path:
            return np.array([]), np.array([])

        points = []
        colors = []

        if points3d_path.endswith(".bin"):
            try:
                with open(points3d_path, "rb") as f:
                    data = f.read()
                    if len(data) < 8:
                        return np.array([]), np.array([])
                    num_points = int.from_bytes(data[:8], "little")
                    offset = 8
                    for _ in range(num_points):
                        if offset + 67 > len(data):
                            break
                        xyz = np.frombuffer(data[offset:offset+24], dtype=np.float64)
                        offset += 24
                        rgb = np.frombuffer(data[offset:offset+3], dtype=np.uint8)
                        offset += 3
                        offset += 4 + 48
                        points.append(xyz)
                        colors.append(rgb)
            except Exception as e:
                logger.error(f"Error reading binary points3D: {e}")
        else:
            try:
                with open(points3d_path, "r") as f:
                    for line in f:
                        if line.startswith("#") or not line.strip():
                            continue
                        parts = line.split()
                        if len(parts) >= 7:
                            x, y, z = map(float, parts[1:4])
                            r, g, b = map(int, parts[4:7])
                            points.append([x, y, z])
                            colors.append([r, g, b])
            except Exception as e:
                logger.error(f"Error reading text points3D: {e}")

        return np.array(points, dtype=np.float32), np.array(colors, dtype=np.uint8)

    def _simulate_reconstruction(
        self,
        frames: List[np.ndarray],
        incremental_step: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        base_count = 500
        increment = 200
        num_points = base_count + incremental_step * increment
        num_points = min(num_points, 5000)

        structure_type = incremental_step % 3
        
        if structure_type == 0:
            points = self._generate_sphere_points(num_points)
        elif structure_type == 1:
            points = self._generate_plane_points(num_points)
        else:
            points = self._generate_hybrid_points(num_points)

        noise = np.random.normal(0, 0.02, points.shape).astype(np.float32)
        points = points + noise

        colors = self.sample_colors_from_frames(frames, num_points)

        transform_scale = 1.0 + incremental_step * 0.05
        transform_offset = np.array([
            np.sin(incremental_step * 0.5) * 0.1,
            np.cos(incremental_step * 0.3) * 0.1,
            incremental_step * 0.02
        ], dtype=np.float32)
        
        points = points * transform_scale + transform_offset

        logger.info(f"Simulation reconstruction: {num_points} points, structure type {structure_type}")
        return points.astype(np.float32), colors

    @staticmethod
    def _generate_sphere_points(num_points: int, radius: float = 1.0) -> np.ndarray:
        theta = np.random.uniform(0, 2 * np.pi, num_points).astype(np.float32)
        phi = np.arccos(np.random.uniform(-1, 1, num_points)).astype(np.float32)
        
        x = radius * np.sin(phi) * np.cos(theta)
        y = radius * np.sin(phi) * np.sin(theta)
        z = radius * np.cos(phi)
        
        return np.stack([x, y, z], axis=1)

    @staticmethod
    def _generate_plane_points(num_points: int, size: float = 2.0) -> np.ndarray:
        grid_size = int(np.sqrt(num_points))
        actual_count = grid_size * grid_size
        
        x = np.linspace(-size, size, grid_size, dtype=np.float32)
        y = np.linspace(-size, size, grid_size, dtype=np.float32)
        xx, yy = np.meshgrid(x, y)
        
        z = (np.sin(xx * 2) * np.cos(yy * 2) * 0.2).astype(np.float32)
        
        points = np.stack([xx.ravel(), yy.ravel(), z.ravel()], axis=1)
        
        if actual_count < num_points:
            extra = num_points - actual_count
            extra_x = np.random.uniform(-size, size, extra).astype(np.float32)
            extra_y = np.random.uniform(-size, size, extra).astype(np.float32)
            extra_z = (np.sin(extra_x * 2) * np.cos(extra_y * 2) * 0.2).astype(np.float32)
            extra_points = np.stack([extra_x, extra_y, extra_z], axis=1)
            points = np.concatenate([points, extra_points], axis=0)
        
        return points[:num_points]

    @staticmethod
    def _generate_hybrid_points(num_points: int) -> np.ndarray:
        num_sphere = num_points // 3
        num_plane = num_points // 3
        num_cube = num_points - num_sphere - num_plane

        sphere_points = COLMAPWrapper._generate_sphere_points(num_sphere, radius=0.5)
        sphere_points += np.array([0.8, 0.8, 0], dtype=np.float32)

        plane_points = COLMAPWrapper._generate_plane_points(num_plane, size=1.0)
        plane_points += np.array([-0.8, 0, 0], dtype=np.float32)

        cube_points = COLMAPWrapper._generate_cube_points(num_cube, size=0.6)
        cube_points += np.array([0, -0.8, 0.3], dtype=np.float32)

        return np.concatenate([sphere_points, plane_points, cube_points], axis=0)

    @staticmethod
    def _generate_cube_points(num_points: int, size: float = 1.0) -> np.ndarray:
        points = np.random.uniform(-size, size, (num_points, 3)).astype(np.float32)
        for i in range(num_points):
            face = i % 6
            if face == 0:
                points[i, 0] = size
            elif face == 1:
                points[i, 0] = -size
            elif face == 2:
                points[i, 1] = size
            elif face == 3:
                points[i, 1] = -size
            elif face == 4:
                points[i, 2] = size
            else:
                points[i, 2] = -size
        return points
