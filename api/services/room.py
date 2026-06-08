from typing import Dict, Optional, List
import uuid
import time

from api.models.room import Room, RoomStatus
from api.models.user import User
from api.services.user import UserService


class RoomService:
    def __init__(self, user_service):
        self._rooms: Dict[str, Room] = {}
        self._user_service = user_service

    def create_room(self, creator_name: str) -> Room:
        from api.models.user import UserRole

        room_id = uuid.uuid4().hex[:8].upper()
        now = int(time.time() * 1000)

        creator = self._user_service.create_user(
            room_id=room_id,
            username=creator_name,
            role=UserRole.CREATOR,
        )

        room = Room(
            room_id=room_id,
            name=f"Room {room_id}",
            creator_id=creator.user_id,
            created_at=now,
            status=RoomStatus.IDLE,
            users=[creator],
        )

        self._rooms[room_id] = room
        return room

    def get_room(self, room_id: str) -> Optional[Room]:
        return self._rooms.get(room_id)

    def add_user_to_room(self, room_id: str, user: User) -> Optional[Room]:
        room = self.get_room(room_id)
        if room is None:
            return None

        existing_user_ids = {u.user_id for u in room.users}
        if user.user_id not in existing_user_ids:
            room.users.append(user)

        return room

    def remove_user_from_room(self, room_id: str, user_id: str) -> Optional[Room]:
        room = self.get_room(room_id)
        if room is None:
            return None

        room.users = [u for u in room.users if u.user_id != user_id]
        return room

    def update_room_status(
        self, room_id: str, status: RoomStatus
    ) -> Optional[Room]:
        room = self.get_room(room_id)
        if room is None:
            return None
        room.status = status
        return room

    def refresh_room_users(self, room_id: str) -> Optional[Room]:
        room = self.get_room(room_id)
        if room is None:
            return None

        room.users = self._user_service.get_users_by_room(room_id)
        return room

    def delete_room(self, room_id: str) -> bool:
        if room_id not in self._rooms:
            return False
        del self._rooms[room_id]
        return True

    def get_all_rooms(self) -> List[Room]:
        return list(self._rooms.values())
