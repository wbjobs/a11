from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    CREATOR = "creator"
    COLLABORATOR = "collaborator"
    VIEWER = "viewer"


class User(BaseModel):
    user_id: str = Field(..., alias="userId")
    room_id: str = Field(..., alias="roomId")
    name: str
    role: UserRole
    is_online: bool = Field(..., alias="isOnline")
    has_video: bool = Field(..., alias="hasVideo")
    video_stream_id: Optional[str] = Field(None, alias="videoStreamId")
    socket_id: Optional[str] = Field(None, alias="socketId")

    class Config:
        populate_by_name = True
