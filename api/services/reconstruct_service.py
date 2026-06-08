import os
import asyncio
import logging
import time
import json
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any, Callable, Tuple
from datetime import datetime
from collections import deque
import numpy as np

from api.utils.colmap_wrapper import COLMAPWrapper

logger = logging.getLogger(__name__)


@dataclass
class ReconstructionVersion:
    version_id: int
    timestamp: float
    num_points: int
    points: np.ndarray
    colors: np.ndarray
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_id": self.version_id,
            "timestamp": self.timestamp,
            "num_points": self.num_points,
            "metadata": self.metadata
        }


@dataclass
class ReconstructionProgress:
    status: str
    progress: float
    message: str
    current_version: int
    total_points: int
    estimated_time_remaining: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class FrameData:
    frame_id: int
    data: np.ndarray
    timestamp: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class ReconstructionService:
    def __init__(
        self,
        output_dir: str = "e:/trae3/a11/api/output",
        frames_per_reconstruction: int = 10,
        max_versions: int = 20,
        colmap_path: Optional[str] = None
    ):
        self.output_dir = output_dir
        self.frames_per_reconstruction = frames_per_reconstruction
        self.max_versions = max_versions
        
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "temp"), exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "versions"), exist_ok=True)

        self.colmap_wrapper = COLMAPWrapper(colmap_path)
        
        self._frame_queue: asyncio.Queue[FrameData] = asyncio.Queue()
        self._frames: List[FrameData] = []
        self._current_version = 0
        self._versions: deque[ReconstructionVersion] = deque(maxlen=max_versions)
        self._progress: ReconstructionProgress = ReconstructionProgress(
            status="idle",
            progress=0.0,
            message="等待帧数据...",
            current_version=0,
            total_points=0
        )
        
        self._is_running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._callbacks: List[Callable[[Dict[str, Any]], None]] = []
        self._lock = asyncio.Lock()
        
        self._total_frames_received = 0
        self._last_reconstruction_time: Optional[float] = None
        self._reconstruction_count = 0

    @property
    def colmap_available(self) -> bool:
        return self.colmap_wrapper.is_available

    @property
    def current_progress(self) -> ReconstructionProgress:
        return self._progress

    @property
    def current_version(self) -> int:
        return self._current_version

    @property
    def versions(self) -> List[ReconstructionVersion]:
        return list(self._versions)

    def register_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        self._callbacks.append(callback)
        logger.info(f"Registered callback, total callbacks: {len(self._callbacks)}")

    def unregister_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        if callback in self._callbacks:
            self._callbacks.remove(callback)
            logger.info(f"Unregistered callback, total callbacks: {len(self._callbacks)}")

    async def add_frame(self, frame_data: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> None:
        async with self._lock:
            self._total_frames_received += 1
            frame = FrameData(
                frame_id=self._total_frames_received,
                data=frame_data,
                timestamp=time.time(),
                metadata=metadata or {}
            )
            await self._frame_queue.put(frame)
            logger.debug(f"Added frame {frame.frame_id} to queue, queue size: {self._frame_queue.qsize()}")

    async def start(self) -> None:
        if self._is_running:
            logger.warning("Reconstruction service is already running")
            return
        
        self._is_running = True
        self._progress.status = "running"
        self._progress.message = "重建服务已启动，正在处理帧..."
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info("Reconstruction service started")

    async def stop(self) -> None:
        if not self._is_running:
            logger.warning("Reconstruction service is not running")
            return
        
        self._is_running = False
        self._progress.status = "stopped"
        self._progress.message = "重建服务已停止"
        
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
        
        logger.info("Reconstruction service stopped")

    async def _worker_loop(self) -> None:
        logger.info("Worker loop started")
        try:
            while self._is_running:
                try:
                    frame = await asyncio.wait_for(self._frame_queue.get(), timeout=1.0)
                    self._frames.append(frame)
                    self._progress.progress = min(
                        1.0,
                        (len(self._frames) % self.frames_per_reconstruction) / self.frames_per_reconstruction
                    )
                    self._progress.message = f"已收集 {len(self._frames)} 帧，等待重建..."
                    await self._notify_callbacks({"type": "progress", "data": self._progress.to_dict()})
                    
                    if len(self._frames) >= self.frames_per_reconstruction:
                        await self._trigger_reconstruction()
                        self._frames.clear()
                    
                    self._frame_queue.task_done()
                    
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    logger.error(f"Error in worker loop: {e}", exc_info=True)
                    self._progress.status = "error"
                    self._progress.message = f"处理错误: {str(e)}"
                    await self._notify_callbacks({"type": "error", "data": {"message": str(e)}})
                    await asyncio.sleep(1.0)
                    
        except asyncio.CancelledError:
            logger.info("Worker loop cancelled")
        except Exception as e:
            logger.error(f"Fatal error in worker loop: {e}", exc_info=True)
        finally:
            logger.info("Worker loop exited")

    async def _trigger_reconstruction(self) -> None:
        if len(self._frames) < 2:
            logger.warning("Not enough frames for reconstruction")
            return

        start_time = time.time()
        self._reconstruction_count += 1
        
        self._progress.status = "reconstructing"
        self._progress.message = f"正在进行第 {self._reconstruction_count} 次重建..."
        self._progress.progress = 0.1
        await self._notify_callbacks({"type": "progress", "data": self._progress.to_dict()})

        try:
            frames_np = [f.data for f in self._frames]
            
            self._progress.progress = 0.3
            self._progress.message = "正在提取特征点..."
            await self._notify_callbacks({"type": "progress", "data": self._progress.to_dict()})
            
            features = self.colmap_wrapper.extract_features(frames_np)
            
            self._progress.progress = 0.5
            self._progress.message = "正在进行三维重建..."
            await self._notify_callbacks({"type": "progress", "data": self._progress.to_dict()})
            
            incremental_step = self._current_version
            output_dir = os.path.join(self.output_dir, "temp", f"recon_{self._reconstruction_count}")
            
            points, colors = await asyncio.to_thread(
                self.colmap_wrapper.run_sparse_reconstruction,
                frames_np,
                output_dir,
                incremental_step
            )
            
            if len(points) == 0 or len(colors) == 0:
                raise ValueError("重建结果为空")
            
            self._progress.progress = 0.8
            self._progress.message = "正在保存重建结果..."
            await self._notify_callbacks({"type": "progress", "data": self._progress.to_dict()})
            
            version = await self._save_version(points, colors, features)
            
            self._current_version = version.version_id
            self._progress.current_version = self._current_version
            self._progress.total_points = version.num_points
            self._progress.progress = 1.0
            self._progress.status = "running"
            self._progress.message = f"重建完成！版本 {self._current_version}，共 {version.num_points} 个点"
            
            elapsed = time.time() - start_time
            self._last_reconstruction_time = elapsed
            self._progress.estimated_time_remaining = elapsed
            
            await self._notify_callbacks({
                "type": "pointcloud",
                "data": {
                    "version_id": version.version_id,
                    "timestamp": version.timestamp,
                    "num_points": version.num_points,
                    "points": version.points.tolist(),
                    "colors": version.colors.tolist(),
                    "metadata": version.metadata
                }
            })
            
            await self._notify_callbacks({"type": "progress", "data": self._progress.to_dict()})
            
            logger.info(f"Reconstruction {self._reconstruction_count} completed: {version.num_points} points, version {version.version_id}")

        except Exception as e:
            logger.error(f"Reconstruction failed: {e}", exc_info=True)
            self._progress.status = "error"
            self._progress.message = f"重建失败: {str(e)}"
            await self._notify_callbacks({"type": "error", "data": {"message": str(e)}})
            
            self._progress.status = "running"
            self._progress.message = "继续处理帧..."
            await self._notify_callbacks({"type": "progress", "data": self._progress.to_dict()})

    async def _save_version(
        self,
        points: np.ndarray,
        colors: np.ndarray,
        features: List[np.ndarray]
    ) -> ReconstructionVersion:
        version_id = self._current_version + 1
        timestamp = time.time()
        
        version_dir = os.path.join(self.output_dir, "versions", f"v{version_id}")
        os.makedirs(version_dir, exist_ok=True)
        
        try:
            np.save(os.path.join(version_dir, "points.npy"), points)
            np.save(os.path.join(version_dir, "colors.npy"), colors)
            
            metadata = {
                "version_id": version_id,
                "timestamp": timestamp,
                "num_points": len(points),
                "num_frames": len(self._frames),
                "colmap_used": self.colmap_wrapper.is_available,
                "feature_counts": [len(f) for f in features],
                "bounds": {
                    "min": points.min(axis=0).tolist(),
                    "max": points.max(axis=0).tolist(),
                    "center": points.mean(axis=0).tolist()
                }
            }
            
            with open(os.path.join(version_dir, "metadata.json"), "w") as f:
                json.dump(metadata, f, indent=2)
            
            version = ReconstructionVersion(
                version_id=version_id,
                timestamp=timestamp,
                num_points=len(points),
                points=points,
                colors=colors,
                metadata=metadata
            )
            
            self._versions.append(version)
            
            self._save_versions_index()
            
            return version
            
        except Exception as e:
            logger.error(f"Failed to save version {version_id}: {e}", exc_info=True)
            raise

    def _save_versions_index(self) -> None:
        try:
            index_data = [v.to_dict() for v in self._versions]
            index_path = os.path.join(self.output_dir, "versions", "index.json")
            with open(index_path, "w") as f:
                json.dump(index_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save versions index: {e}", exc_info=True)

    def get_version(self, version_id: int) -> Optional[ReconstructionVersion]:
        for version in self._versions:
            if version.version_id == version_id:
                return version
        return None

    def get_latest_version(self) -> Optional[ReconstructionVersion]:
        return self._versions[-1] if self._versions else None

    def get_pointcloud_data(self, version_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        if version_id is None:
            version = self.get_latest_version()
        else:
            version = self.get_version(version_id)
        
        if version is None:
            return None
        
        return {
            "version_id": version.version_id,
            "timestamp": version.timestamp,
            "num_points": version.num_points,
            "points": version.points.tolist(),
            "colors": version.colors.tolist(),
            "metadata": version.metadata
        }

    def get_versions_list(self) -> List[Dict[str, Any]]:
        return [v.to_dict() for v in self._versions]

    async def _notify_callbacks(self, message: Dict[str, Any]) -> None:
        for callback in self._callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(message)
                else:
                    callback(message)
            except Exception as e:
                logger.error(f"Callback error: {e}", exc_info=True)

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self._is_running,
            "colmap_available": self.colmap_available,
            "current_version": self._current_version,
            "total_versions": len(self._versions),
            "total_frames_received": self._total_frames_received,
            "frames_in_buffer": len(self._frames),
            "queue_size": self._frame_queue.qsize(),
            "reconstruction_count": self._reconstruction_count,
            "last_reconstruction_time": self._last_reconstruction_time,
            "progress": self._progress.to_dict(),
            "frames_per_reconstruction": self.frames_per_reconstruction,
            "max_versions": self.max_versions,
            "output_dir": self.output_dir
        }

    async def force_reconstruction(self) -> Optional[ReconstructionVersion]:
        if len(self._frames) < 2:
            logger.warning("Not enough frames to force reconstruction")
            return None
        
        logger.info("Forcing reconstruction...")
        await self._trigger_reconstruction()
        return self.get_latest_version()

    def clear_frames(self) -> None:
        self._frames.clear()
        self._total_frames_received = 0
        self._progress.progress = 0.0
        logger.info("Frames buffer cleared")

    async def merge_versions(self, version_ids: List[int]) -> Optional[ReconstructionVersion]:
        versions = [self.get_version(vid) for vid in version_ids]
        versions = [v for v in versions if v is not None]
        
        if len(versions) < 2:
            logger.warning("Need at least 2 versions to merge")
            return None
        
        try:
            all_points = np.concatenate([v.points for v in versions], axis=0)
            all_colors = np.concatenate([v.colors for v in versions], axis=0)
            
            max_points = 10000
            if len(all_points) > max_points:
                indices = np.random.choice(len(all_points), max_points, replace=False)
                all_points = all_points[indices]
                all_colors = all_colors[indices]
            
            features = []
            merged_version = await self._save_version(all_points, all_colors, features)
            merged_version.metadata["merged_from"] = version_ids
            merged_version.metadata["is_merged"] = True
            
            logger.info(f"Merged versions {version_ids} into version {merged_version.version_id} with {merged_version.num_points} points")
            return merged_version
            
        except Exception as e:
            logger.error(f"Failed to merge versions: {e}", exc_info=True)
            return None
