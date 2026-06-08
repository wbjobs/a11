import asyncio
import uuid
import secrets
import hashlib
import time
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass
import logging

from api.models import (
    Room,
    User,
    UserRole,
    RoomStatus,
    CreateRoomResponse,
    JoinRoomResponse,
    TokenData,
    Annotation,
    PointCloudData,
)
from api.services.websocket_manager import WebSocketManager, get_websocket_manager

logger = logging.getLogger(__name__)

TOKEN_EXPIRE_HOURS = 24
TOKEN_SECRET = secrets.token_hex(32)


@dataclass
class RoomState:
    room: Room
    annotations: Dict[str, Annotation]
    point_cloud: Optional[PointCloudData]
    point_cloud_versions: List[PointCloudData]
    created_at: float


class RoomService:
    _instance: Optional["RoomService"] = None
    _lock = asyncio.Lock()

    def __new__(cls) -> "RoomService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized: bool = True
        self._rooms: Dict[str, RoomState] = {}
        self._tokens: Dict[str, TokenData] = {}
        self._ws_manager: WebSocketManager = get_websocket_manager()

    def generate_token(
        self,
        user_id: str,
        room_id: str,
        role: UserRole,
    ) -> str:
        exp = time.time() + TOKEN_EXPIRE_HOURS * 3600
        token_data = TokenData(
            userId=user_id,
            roomId=room_id,
            role=role,
            exp=exp,
        )
        raw_token = f"{user_id}:{room_id}:{role.value}:{exp}:{TOKEN_SECRET}"
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        token = f"{user_id}.{room_id}.{token_hash}"
        self._tokens[token] = token_data
        return token

    def verify_token(self, token: str) -> Optional[TokenData]:
        token_data = self._tokens.get(token)
        if not token_data:
            return None
        if token_data.exp < time.time():
            del self._tokens[token]
            return None
        return token_data

    def invalidate_token(self, token: str) -> None:
        self._tokens.pop(token, None)

    async def create_room(
        self,
        username: str,
    ) -> Tuple[Room, User, str]:
        async with self._lock:
            room_id = self._generate_room_id()
            user_id = self._generate_user_id()

            user = User(
                userId=user_id,
                roomId=room_id,
                name=username,
                role=UserRole.CREATOR,
                isOnline=True,
            )

            room = Room(
                roomId=room_id,
                name=f"{username}'s Room",
                creatorId=user_id,
                users=[user],
            )

            room_state = RoomState(
                room=room,
                annotations={},
                point_cloud=None,
                point_cloud_versions=[],
                created_at=time.time(),
            )

            self._rooms[room_id] = room_state
            token = self.generate_token(user_id, room_id, UserRole.CREATOR)
            user.token = token

            logger.info(f"Room {room_id} created by user {user_id} ({username})")
            return room, user, token

    async def join_room(
        self,
        room_id: str,
        username: str,
        role: UserRole,
    ) -> Optional[Tuple[User, str, List[User], Optional[PointCloudData], List[Annotation]]]:
        async with self._lock:
            room_state = self._rooms.get(room_id)
            if not room_state:
                return None

            user_id = self._generate_user_id()

            user = User(
                userId=user_id,
                roomId=room_id,
                name=username,
                role=role,
                isOnline=True,
            )

            room_state.room.users.append(user)
            token = self.generate_token(user_id, room_id, role)
            user.token = token

            users = [u.model_copy(exclude={"token"}) for u in room_state.room.users]
            point_cloud = room_state.point_cloud
            annotations = list(room_state.annotations.values())

            logger.info(
                f"User {user_id} ({username}) joined room {room_id} as {role.value}"
            )
            return user, token, users, point_cloud, annotations

    async def leave_room(
        self,
        room_id: str,
        user_id: str,
        token: Optional[str] = None,
    ) -> bool:
        async with self._lock:
            room_state = self._rooms.get(room_id)
            if not room_state:
                return False

            room = room_state.room
            user = self._find_user(room, user_id)
            if not user:
                return False

            room.users = [u for u in room.users if u.userId != user_id]
            user.isOnline = False

            if token:
                self.invalidate_token(token)

            if not room.users:
                await self._cleanup_room(room_id)
                logger.info(f"Room {room_id} cleaned up - no users remaining")
            elif room.creatorId == user_id:
                new_creator = self._find_new_creator(room)
                if new_creator:
                    room.creatorId = new_creator.userId
                    new_creator.role = UserRole.CREATOR
                    logger.info(
                        f"Room {room_id} creator transferred to {new_creator.userId}"
                    )

            logger.info(f"User {user_id} left room {room_id}")
            return True

    async def get_room(self, room_id: str) -> Optional[Room]:
        room_state = self._rooms.get(room_id)
        return room_state.room if room_state else None

    async def get_user(
        self,
        room_id: str,
        user_id: str,
    ) -> Optional[User]:
        room_state = self._rooms.get(room_id)
        if not room_state:
            return None
        return self._find_user(room_state.room, user_id)

    async def get_room_users(self, room_id: str) -> Optional[List[User]]:
        room_state = self._rooms.get(room_id)
        if not room_state:
            return None
        return [u.model_copy(exclude={"token"}) for u in room_state.room.users]

    async def update_user_status(
        self,
        room_id: str,
        user_id: str,
        is_online: Optional[bool] = None,
        has_video: Optional[bool] = None,
        video_stream_id: Optional[str] = None,
    ) -> Optional[User]:
        async with self._lock:
            room_state = self._rooms.get(room_id)
            if not room_state:
                return None

            user = self._find_user(room_state.room, user_id)
            if not user:
                return None

            if is_online is not None:
                user.isOnline = is_online
            if has_video is not None:
                user.has_video = has_video
            if video_stream_id is not None:
                user.videoStreamId = video_stream_id

            return user.model_copy(exclude={"token"})

    async def update_room_status(
        self,
        room_id: str,
        status: RoomStatus,
    ) -> Optional[Room]:
        async with self._lock:
            room_state = self._rooms.get(room_id)
            if not room_state:
                return None

            room_state.room.status = status
            logger.info(f"Room {room_id} status updated to {status.value}")
            return room_state.room

    async def set_point_cloud(
        self,
        room_id: str,
        point_cloud: PointCloudData,
    ) -> None:
        async with self._lock:
            room_state = self._rooms.get(room_id)
            if not room_state:
                return

            room_state.point_cloud = point_cloud
            room_state.point_cloud_versions.append(point_cloud)

            if len(room_state.point_cloud_versions) > 100:
                room_state.point_cloud_versions = room_state.point_cloud_versions[-100:]

    async def get_point_cloud(self, room_id: str) -> Optional[PointCloudData]:
        room_state = self._rooms.get(room_id)
        return room_state.point_cloud if room_state else None

    async def get_point_cloud_versions(self, room_id: str) -> Optional[List[PointCloudData]]:
        room_state = self._rooms.get(room_id)
        if not room_state:
            return None
        return list(room_state.point_cloud_versions)

    async def on_user_connect(
        self,
        room_id: str,
        user_id: str,
    ) -> Optional[User]:
        user = await self.update_user_status(room_id, user_id, is_online=True)
        if user:
            await self._ws_manager.broadcast_user_join(room_id, user)
        return user

    async def on_user_disconnect(
        self,
        room_id: str,
        user_id: str,
    ) -> None:
        await self.update_user_status(room_id, user_id, is_online=False)
        await self._ws_manager.broadcast_user_leave(room_id, user_id)

    def room_exists(self, room_id: str) -> bool:
        return room_id in self._rooms

    def get_room_count(self) -> int:
        return len(self._rooms)

    def _generate_room_id(self) -> str:
        while True:
            room_id = str(uuid.uuid4())[:8].upper()
            if room_id not in self._rooms:
                return room_id

    def _generate_user_id(self) -> str:
        return str(uuid.uuid4())

    def _find_user(self, room: Room, user_id: str) -> Optional[User]:
        for user in room.users:
            if user.userId == user_id:
                return user
        return None

    def _find_new_creator(self, room: Room) -> Optional[User]:
        for user in room.users:
            if user.role in (UserRole.CREATOR, UserRole.COLLABORATOR):
                return user
        if room.users:
            return room.users[0]
        return None

    async def _cleanup_room(self, room_id: str) -> None:
        room_state = self._rooms.pop(room_id, None)
        if room_state:
            for user in room_state.room.users:
                if user.token:
                    self.invalidate_token(user.token)


def get_room_service() -> RoomService:
    return RoomService()
