from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class AnnotationType(str, Enum):
    ARROW = "arrow"
    SPHERE = "sphere"
    TEXT = "text"


class Annotation(BaseModel):
    annotation_id: str = Field(..., alias="annotationId")
    room_id: str = Field(..., alias="roomId")
    user_id: str = Field(..., alias="userId")
    user_name: str = Field(..., alias="userName")
    point_cloud_version_id: str = Field(..., alias="pointCloudVersionId")
    type: AnnotationType
    position: List[float]
    direction: Optional[List[float]] = None
    color: str
    size: float
    text: Optional[str] = None
    created_at: int = Field(..., alias="createdAt")
    updated_at: int = Field(..., alias="updatedAt")

    class Config:
        populate_by_name = True
