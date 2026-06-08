from typing import List, Optional
from pydantic import BaseModel, Field

from api.models.user import UserRole, User
from api.models.pointcloud import PointCloudVersion, PointCloudData
from api.models.annotation import Annotation


class CreateRoomRequest(BaseModel):
    username: str


class CreateRoomResponse(BaseModel):
    room_id: str = Field(..., alias="roomId")
    user_id: str = Field(..., alias="userId")
    token: str

    class Config:
        populate_by_name = True


class JoinRoomRequest(BaseModel):
    room_id: str = Field(..., alias="roomId")
    username: str
    role: UserRole

    class Config:
        populate_by_name = True


class JoinRoomResponse(BaseModel):
    user_id: str = Field(..., alias="userId")
    token: str
    users: List[User]
    point_cloud: Optional[PointCloudData] = Field(None, alias="pointCloud")
    annotations: List[Annotation]

    class Config:
        populate_by_name = True


class FrameUploadResponse(BaseModel):
    success: bool
    queued: bool
    message: Optional[str] = None


class PointCloudHistoryResponse(BaseModel):
    versions: List[PointCloudVersion]
