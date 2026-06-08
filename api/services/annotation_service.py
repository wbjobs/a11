import asyncio
import uuid
import time
from typing import Dict, Optional, List, Tuple
import logging

from api.models import (
    Annotation,
    AnnotationType,
    User,
    UserRole,
)
from api.services.websocket_manager import WebSocketManager, get_websocket_manager
from api.services.room_service import RoomService, get_room_service

logger = logging.getLogger(__name__)


class AnnotationService:
    _instance: Optional["AnnotationService"] = None
    _lock = asyncio.Lock()

    def __new__(cls) -> "AnnotationService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized: bool = True
        self._ws_manager: WebSocketManager = get_websocket_manager()
        self._room_service: RoomService = get_room_service()

    async def add_annotation(
        self,
        room_id: str,
        user: User,
        annotation_type: AnnotationType,
        position: Tuple[float, float, float],
        color: str,
        size: float,
        point_cloud_version_id: str,
        direction: Optional[Tuple[float, float, float]] = None,
        text: Optional[str] = None,
    ) -> Optional[Annotation]:
        if not await self._check_permission(user, "add"):
            logger.warning(
                f"User {user.userId} does not have permission to add annotations in room {room_id}"
            )
            return None

        async with self._lock:
            room_state = self._room_service._rooms.get(room_id)
            if not room_state:
                logger.warning(f"Room {room_id} not found")
                return None

            annotation_id = self._generate_annotation_id()
            now = time.time()

            annotation = Annotation(
                annotationId=annotation_id,
                roomId=room_id,
                userId=user.userId,
                userName=user.name,
                pointCloudVersionId=point_cloud_version_id,
                type=annotation_type,
                position=position,
                direction=direction,
                color=color,
                size=size,
                text=text,
                createdAt=now,
                updatedAt=now,
            )

            room_state.annotations[annotation_id] = annotation

        await self._ws_manager.broadcast_annotation(
            room_id,
            annotation,
            action="add",
            exclude_user_id=user.userId,
        )

        logger.info(
            f"Annotation {annotation_id} added by user {user.userId} in room {room_id}"
        )
        return annotation

    async def update_annotation(
        self,
        room_id: str,
        user: User,
        annotation_id: str,
        position: Optional[Tuple[float, float, float]] = None,
        direction: Optional[Tuple[float, float, float]] = None,
        color: Optional[str] = None,
        size: Optional[float] = None,
        text: Optional[str] = None,
    ) -> Optional[Annotation]:
        async with self._lock:
            room_state = self._room_service._rooms.get(room_id)
            if not room_state:
                logger.warning(f"Room {room_id} not found")
                return None

            annotation = room_state.annotations.get(annotation_id)
            if not annotation:
                logger.warning(f"Annotation {annotation_id} not found in room {room_id}")
                return None

            if not await self._check_permission(user, "update", annotation):
                logger.warning(
                    f"User {user.userId} does not have permission to update annotation {annotation_id}"
                )
                return None

            if position is not None:
                annotation.position = position
            if direction is not None:
                annotation.direction = direction
            if color is not None:
                annotation.color = color
            if size is not None:
                annotation.size = size
            if text is not None:
                annotation.text = text

            annotation.updatedAt = time.time()

        await self._ws_manager.broadcast_annotation(
            room_id,
            annotation,
            action="update",
            exclude_user_id=user.userId,
        )

        logger.info(
            f"Annotation {annotation_id} updated by user {user.userId} in room {room_id}"
        )
        return annotation

    async def delete_annotation(
        self,
        room_id: str,
        user: User,
        annotation_id: str,
    ) -> bool:
        async with self._lock:
            room_state = self._room_service._rooms.get(room_id)
            if not room_state:
                logger.warning(f"Room {room_id} not found")
                return False

            annotation = room_state.annotations.get(annotation_id)
            if not annotation:
                logger.warning(f"Annotation {annotation_id} not found in room {room_id}")
                return False

            if not await self._check_permission(user, "delete", annotation):
                logger.warning(
                    f"User {user.userId} does not have permission to delete annotation {annotation_id}"
                )
                return False

            del room_state.annotations[annotation_id]

        await self._ws_manager.broadcast_annotation(
            room_id,
            annotation_id,
            action="delete",
            exclude_user_id=user.userId,
        )

        logger.info(
            f"Annotation {annotation_id} deleted by user {user.userId} in room {room_id}"
        )
        return True

    async def get_annotation(
        self,
        room_id: str,
        annotation_id: str,
    ) -> Optional[Annotation]:
        room_state = self._room_service._rooms.get(room_id)
        if not room_state:
            return None
        return room_state.annotations.get(annotation_id)

    async def get_room_annotations(
        self,
        room_id: str,
        point_cloud_version_id: Optional[str] = None,
    ) -> Optional[List[Annotation]]:
        room_state = self._room_service._rooms.get(room_id)
        if not room_state:
            return None

        annotations = list(room_state.annotations.values())

        if point_cloud_version_id:
            annotations = [
                a for a in annotations
                if a.pointCloudVersionId == point_cloud_version_id
            ]

        return annotations

    async def get_user_annotations(
        self,
        room_id: str,
        user_id: str,
    ) -> Optional[List[Annotation]]:
        room_state = self._room_service._rooms.get(room_id)
        if not room_state:
            return None

        return [
            a for a in room_state.annotations.values()
            if a.userId == user_id
        ]

    async def clear_room_annotations(
        self,
        room_id: str,
        user: User,
    ) -> bool:
        if user.role != UserRole.CREATOR:
            logger.warning(
                f"User {user.userId} does not have permission to clear annotations in room {room_id}"
            )
            return False

        async with self._lock:
            room_state = self._room_service._rooms.get(room_id)
            if not room_state:
                return False

            annotation_ids = list(room_state.annotations.keys())
            room_state.annotations.clear()

        for annotation_id in annotation_ids:
            await self._ws_manager.broadcast_annotation(
                room_id,
                annotation_id,
                action="delete",
            )

        logger.info(
            f"All annotations cleared in room {room_id} by user {user.userId}"
        )
        return True

    async def handle_message(
        self,
        message_type: str,
        data: Dict,
        user: User,
    ) -> None:
        room_id = user.roomId

        if message_type == "annotation_add":
            await self._handle_add_message(data, user, room_id)
        elif message_type == "annotation_update":
            await self._handle_update_message(data, user, room_id)
        elif message_type == "annotation_delete":
            await self._handle_delete_message(data, user, room_id)

    async def _handle_add_message(
        self,
        data: Dict,
        user: User,
        room_id: str,
    ) -> None:
        try:
            annotation_type = AnnotationType(data.get("type", "sphere"))
            position = tuple(data.get("position", [0.0, 0.0, 0.0]))
            color = data.get("color", "#64FFDA")
            size = data.get("size", 0.1)
            point_cloud_version_id = data.get("pointCloudVersionId", "")
            direction = data.get("direction")
            text = data.get("text")

            if direction:
                direction = tuple(direction)

            await self.add_annotation(
                room_id=room_id,
                user=user,
                annotation_type=annotation_type,
                position=position,
                color=color,
                size=size,
                point_cloud_version_id=point_cloud_version_id,
                direction=direction,
                text=text,
            )
        except Exception as e:
            logger.error(f"Error handling annotation_add message: {e}")

    async def _handle_update_message(
        self,
        data: Dict,
        user: User,
        room_id: str,
    ) -> None:
        try:
            annotation_id = data.get("annotationId")
            if not annotation_id:
                logger.warning("annotation_update message missing annotationId")
                return

            position = data.get("position")
            direction = data.get("direction")
            color = data.get("color")
            size = data.get("size")
            text = data.get("text")

            if position:
                position = tuple(position)
            if direction:
                direction = tuple(direction)

            await self.update_annotation(
                room_id=room_id,
                user=user,
                annotation_id=annotation_id,
                position=position,
                direction=direction,
                color=color,
                size=size,
                text=text,
            )
        except Exception as e:
            logger.error(f"Error handling annotation_update message: {e}")

    async def _handle_delete_message(
        self,
        data: Dict,
        user: User,
        room_id: str,
    ) -> None:
        try:
            annotation_id = data.get("annotationId")
            if not annotation_id:
                logger.warning("annotation_delete message missing annotationId")
                return

            await self.delete_annotation(
                room_id=room_id,
                user=user,
                annotation_id=annotation_id,
            )
        except Exception as e:
            logger.error(f"Error handling annotation_delete message: {e}")

    async def _check_permission(
        self,
        user: User,
        action: str,
        annotation: Optional[Annotation] = None,
    ) -> bool:
        if user.role == UserRole.VIEWER:
            return False

        if user.role == UserRole.CREATOR:
            return True

        if annotation and action in ("update", "delete"):
            return annotation.userId == user.userId

        return True

    def _generate_annotation_id(self) -> str:
        return str(uuid.uuid4())

    def get_annotation_count(self, room_id: str) -> int:
        room_state = self._room_service._rooms.get(room_id)
        return len(room_state.annotations) if room_state else 0


def get_annotation_service() -> AnnotationService:
    return AnnotationService()
