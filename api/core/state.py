from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

from fastapi import WebSocket


@dataclass
class User:
    id: UUID
    name: str
    room_id: Optional[UUID] = None
    joined_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "room_id": str(self.room_id) if self.room_id else None,
            "joined_at": self.joined_at.isoformat(),
        }


@dataclass
class Room:
    id: UUID
    name: str
    host_id: UUID
    users: Dict[UUID, User] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_user(self, user: User) -> None:
        user.room_id = self.id
        self.users[user.id] = user

    def remove_user(self, user_id: UUID) -> Optional[User]:
        user = self.users.pop(user_id, None)
        if user:
            user.room_id = None
        return user

    def has_user(self, user_id: UUID) -> bool:
        return user_id in self.users

    def is_empty(self) -> bool:
        return len(self.users) == 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "host_id": str(self.host_id),
            "users": [user.to_dict() for user in self.users.values()],
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class Connection:
    websocket: WebSocket
    user_id: UUID
    room_id: Optional[UUID] = None
    connected_at: datetime = field(default_factory=datetime.now)


class GlobalState:
    def __init__(self) -> None:
        self._rooms: Dict[UUID, Room] = {}
        self._users: Dict[UUID, User] = {}
        self._connections: Dict[UUID, Connection] = {}
        self._lock = asyncio.Lock()

    async def create_room(self, name: str, host_id: UUID, metadata: Optional[Dict[str, Any]] = None) -> Room:
        async with self._lock:
            room_id = uuid4()
            room = Room(
                id=room_id,
                name=name,
                host_id=host_id,
                metadata=metadata or {},
            )
            self._rooms[room_id] = room
            return room

    async def get_room(self, room_id: UUID) -> Optional[Room]:
        return self._rooms.get(room_id)

    async def get_all_rooms(self) -> list[Room]:
        return list(self._rooms.values())

    async def delete_room(self, room_id: UUID) -> bool:
        async with self._lock:
            room = self._rooms.get(room_id)
            if room and room.is_empty():
                del self._rooms[room_id]
                return True
            return False

    async def create_user(self, name: str) -> User:
        async with self._lock:
            user_id = uuid4()
            user = User(id=user_id, name=name)
            self._users[user_id] = user
            return user

    async def get_user(self, user_id: UUID) -> Optional[User]:
        return self._users.get(user_id)

    async def delete_user(self, user_id: UUID) -> bool:
        async with self._lock:
            user = self._users.get(user_id)
            if user and user.room_id:
                room = self._rooms.get(user.room_id)
                if room:
                    room.remove_user(user_id)
                    if room.is_empty():
                        del self._rooms[room.id]
            return self._users.pop(user_id, None) is not None

    async def join_room(self, user_id: UUID, room_id: UUID) -> bool:
        async with self._lock:
            user = self._users.get(user_id)
            room = self._rooms.get(room_id)
            if not user or not room:
                return False
            if user.room_id and user.room_id != room_id:
                old_room = self._rooms.get(user.room_id)
                if old_room:
                    old_room.remove_user(user_id)
                    if old_room.is_empty():
                        del self._rooms[old_room.id]
            room.add_user(user)
            return True

    async def leave_room(self, user_id: UUID) -> bool:
        async with self._lock:
            user = self._users.get(user_id)
            if not user or not user.room_id:
                return False
            room = self._rooms.get(user.room_id)
            if room:
                room.remove_user(user_id)
                if room.is_empty():
                    del self._rooms[room.id]
            return True

    async def add_connection(self, websocket: WebSocket, user_id: UUID, room_id: Optional[UUID] = None) -> Connection:
        async with self._lock:
            connection = Connection(
                websocket=websocket,
                user_id=user_id,
                room_id=room_id,
            )
            self._connections[user_id] = connection
            return connection

    async def remove_connection(self, user_id: UUID) -> bool:
        async with self._lock:
            return self._connections.pop(user_id, None) is not None

    async def get_connection(self, user_id: UUID) -> Optional[Connection]:
        return self._connections.get(user_id)

    async def get_room_connections(self, room_id: UUID) -> list[Connection]:
        return [conn for conn in self._connections.values() if conn.room_id == room_id]

    async def broadcast_to_room(self, room_id: UUID, message: Dict[str, Any], exclude_user_id: Optional[UUID] = None) -> None:
        connections = await self.get_room_connections(room_id)
        for conn in connections:
            if exclude_user_id and conn.user_id == exclude_user_id:
                continue
            try:
                await conn.websocket.send_json(message)
            except Exception:
                pass

    async def send_to_user(self, user_id: UUID, message: Dict[str, Any]) -> bool:
        conn = await self.get_connection(user_id)
        if not conn:
            return False
        try:
            await conn.websocket.send_json(message)
            return True
        except Exception:
            return False


global_state = GlobalState()
