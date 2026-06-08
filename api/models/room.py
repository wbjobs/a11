from enum import Enum
from typing import List
from pydantic import BaseModel, Field

from api.models.user import User


class RoomStatus(str, Enum):
    IDLE = "idle"
    RECONSTRUCTING = "reconstructing"
    PAUSED = "paused"


class Room(BaseModel):
    room_id: str = Field(..., alias="roomId")
    name: str
    creator_id: str = Field(..., alias="creatorId")
    created_at: int = Field(..., alias="createdAt")
    status: RoomStatus
    users: List[User]

    class Config:
        populate_by_name = True
