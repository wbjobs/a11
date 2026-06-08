from typing import Dict, Optional, List
import uuid
import time

from api.models.pointcloud import PointCloudVersion, PointCloudData


class PointCloudService:
    def __init__(self):
        self._versions: Dict[str, List[PointCloudVersion]] = {}
        self._data: Dict[str, PointCloudData] = {}

    def _get_or_create_versions(self, room_id: str) -> List[PointCloudVersion]:
        if room_id not in self._versions:
            self._versions[room_id] = []
        return self._versions[room_id]

    def create_version(
        self,
        room_id: str,
        point_count: int,
        progress: float,
        data_path: Optional[str] = None,
    ) -> PointCloudVersion:
        versions = self._get_or_create_versions(room_id)
        version_number = len(versions) + 1
        version_id = f"v{version_number}_{uuid.uuid4().hex[:8]}"

        version = PointCloudVersion(
            version_id=version_id,
            room_id=room_id,
            version_number=version_number,
            point_count=point_count,
            progress=progress,
            timestamp=int(time.time() * 1000),
            data_path=data_path,
        )

        versions.append(version)
        return version

    def save_point_cloud_data(
        self,
        version: PointCloudVersion,
        points: List[float],
        colors: List[float],
        camera_poses: Optional[List] = None,
    ) -> PointCloudData:
        data = PointCloudData(
            version_id=version.version_id,
            room_id=version.room_id,
            timestamp=version.timestamp,
            version_number=version.version_number,
            points=points,
            colors=colors,
            point_count=version.point_count,
            camera_poses=camera_poses,
        )

        self._data[version.version_id] = data
        return data

    def get_version_history(self, room_id: str) -> List[PointCloudVersion]:
        return list(self._get_or_create_versions(room_id))

    def get_latest_version(self, room_id: str) -> Optional[PointCloudVersion]:
        versions = self._get_or_create_versions(room_id)
        if not versions:
            return None
        return versions[-1]

    def get_point_cloud_data(self, version_id: str) -> Optional[PointCloudData]:
        return self._data.get(version_id)

    def get_latest_point_cloud(self, room_id: str) -> Optional[PointCloudData]:
        latest_version = self.get_latest_version(room_id)
        if latest_version is None:
            return None
        return self.get_point_cloud_data(latest_version.version_id)

    def update_version_progress(
        self, room_id: str, version_id: str, progress: float
    ) -> Optional[PointCloudVersion]:
        versions = self._get_or_create_versions(room_id)
        for version in versions:
            if version.version_id == version_id:
                version.progress = progress
                return version
        return None

    def delete_room_data(self, room_id: str) -> None:
        if room_id in self._versions:
            for version in self._versions[room_id]:
                if version.version_id in self._data:
                    del self._data[version.version_id]
            del self._versions[room_id]


_pointcloud_service_instance: Optional["PointCloudService"] = None


def get_pointcloud_service() -> "PointCloudService":
    global _pointcloud_service_instance
    if _pointcloud_service_instance is None:
        _pointcloud_service_instance = PointCloudService()
    return _pointcloud_service_instance
