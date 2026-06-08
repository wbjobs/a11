from typing import List, Optional
from pydantic import BaseModel, Field


class CameraPose(BaseModel):
    camera_id: str = Field(..., alias="cameraId")
    position: List[float]
    rotation: List[float]
    focal_length: float = Field(..., alias="focalLength")

    class Config:
        populate_by_name = True


class PointCloudVersion(BaseModel):
    version_id: str = Field(..., alias="versionId")
    room_id: str = Field(..., alias="roomId")
    version_number: int = Field(..., alias="versionNumber")
    point_count: int = Field(..., alias="pointCount")
    progress: float
    timestamp: int
    data_path: Optional[str] = Field(None, alias="dataPath")

    class Config:
        populate_by_name = True


class PointCloudData(BaseModel):
    version_id: str = Field(..., alias="versionId")
    room_id: str = Field(..., alias="roomId")
    timestamp: int
    version_number: int = Field(..., alias="versionNumber")
    points: List[float]
    colors: List[float]
    point_count: int = Field(..., alias="pointCount")
    camera_poses: Optional[List[CameraPose]] = Field(None, alias="cameraPoses")

    class Config:
        populate_by_name = True
