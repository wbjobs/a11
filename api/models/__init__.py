from enum import Enum
from typing import Optional, List, Tuple, Any
from pydantic import BaseModel, Field
from uuid import UUID
import time


class UserRole(str, Enum):
    CREATOR = "creator"
    COLLABORATOR = "collaborator"
    VIEWER = "viewer"


class AnnotationType(str, Enum):
    ARROW = "arrow"
    SPHERE = "sphere"
    TEXT = "text"


class WebSocketMessageType(str, Enum):
    USER_JOIN = "user_join"
    USER_LEAVE = "user_leave"
    POINTCLOUD_UPDATE = "pointcloud_update"
    ANNOTATION_ADD = "annotation_add"
    ANNOTATION_UPDATE = "annotation_update"
    ANNOTATION_DELETE = "annotation_delete"
    RECONSTRUCT_STATUS = "reconstruct_status"
    WEBRTC_OFFER = "webrtc_offer"
    WEBRTC_ANSWER = "webrtc_answer"
    WEBRTC_ICE = "webrtc_ice"


class RoomStatus(str, Enum):
    IDLE = "idle"
    RECONSTRUCTING = "reconstructing"
    PAUSED = "paused"


class ReconstructStatus(str, Enum):
    IDLE = "idle"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class User(BaseModel):
    userId: str
    roomId: str
    name: str
    role: UserRole
    isOnline: bool = True
    hasVideo: bool = False
    videoStreamId: Optional[str] = None
    socketId: Optional[str] = None
    joinedAt: float = Field(default_factory=time.time)
    token: Optional[str] = None


class Room(BaseModel):
    roomId: str
    name: str
    creatorId: str
    createdAt: float = Field(default_factory=time.time)
    status: RoomStatus = RoomStatus.IDLE
    users: List[User] = Field(default_factory=list)


class CameraPose(BaseModel):
    cameraId: str
    position: Tuple[float, float, float]
    rotation: Tuple[float, float, float, float]
    focalLength: float


class PointCloudVersion(BaseModel):
    versionId: str
    roomId: str
    versionNumber: int
    pointCount: int
    progress: float
    timestamp: float = Field(default_factory=time.time)
    dataPath: Optional[str] = None


class PointCloudData(BaseModel):
    versionId: str
    roomId: str
    timestamp: float = Field(default_factory=time.time)
    versionNumber: int
    points: List[float]
    colors: List[float]
    pointCount: int
    cameraPoses: Optional[List[CameraPose]] = None


class Annotation(BaseModel):
    annotationId: str
    roomId: str
    userId: str
    userName: str
    pointCloudVersionId: str
    type: AnnotationType
    position: Tuple[float, float, float]
    direction: Optional[Tuple[float, float, float]] = None
    color: str
    size: float
    text: Optional[str] = None
    createdAt: float = Field(default_factory=time.time)
    updatedAt: float = Field(default_factory=time.time)


class WebRTCSignal(BaseModel):
    from_user_id: str = Field(alias="from")
    to_user_id: str = Field(alias="to")
    type: str
    data: Any

    class Config:
        populate_by_name = True


class WebSocketMessage(BaseModel):
    type: WebSocketMessageType
    data: Any
    timestamp: float = Field(default_factory=time.time)


class ReconstructStatusData(BaseModel):
    status: ReconstructStatus
    progress: float
    message: Optional[str] = None
    framesProcessed: int = 0
    totalFrames: int = 0


class CreateRoomRequest(BaseModel):
    username: str


class CreateRoomResponse(BaseModel):
    roomId: str
    userId: str
    token: str


class JoinRoomRequest(BaseModel):
    roomId: str
    username: str
    role: UserRole


class JoinRoomResponse(BaseModel):
    userId: str
    token: str
    users: List[User]
    pointCloud: Optional[PointCloudData] = None
    annotations: List[Annotation]


class FrameUploadResponse(BaseModel):
    success: bool
    queued: bool
    message: Optional[str] = None


class PointCloudHistoryResponse(BaseModel):
    versions: List[PointCloudVersion]


class TokenData(BaseModel):
    userId: str
    roomId: str
    role: UserRole
    exp: float
