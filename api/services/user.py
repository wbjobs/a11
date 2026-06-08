from typing import Dict, Optional, List
import uuid
import time

from api.models.user import User, UserRole


class UserService:
    def __init__(self):
        self._users: Dict[str, Dict[str, User]] = {}

    def create_user(
        self,
        room_id: str,
        username: str,
        role: UserRole,
        is_online: bool = True,
    ) -> User:
        user_id = f"user_{uuid.uuid4().hex[:8]}"
        user = User(
            user_id=user_id,
            room_id=room_id,
            name=username,
            role=role,
            is_online=is_online,
            has_video=False,
        )

        if room_id not in self._users:
            self._users[room_id] = {}

        self._users[room_id][user_id] = user
        return user

    def get_user(self, room_id: str, user_id: str) -> Optional[User]:
        if room_id not in self._users:
            return None
        return self._users[room_id].get(user_id)

    def get_users_by_room(self, room_id: str) -> List[User]:
        if room_id not in self._users:
            return []
        return list(self._users[room_id].values())

    def update_user_video_status(
        self, room_id: str, user_id: str, has_video: bool
    ) -> Optional[User]:
        user = self.get_user(room_id, user_id)
        if user is None:
            return None
        user.has_video = has_video
        return user

    def set_user_online(self, room_id: str, user_id: str, is_online: bool) -> Optional[User]:
        user = self.get_user(room_id, user_id)
        if user is None:
            return None
        user.is_online = is_online
        return user

    def remove_user(self, room_id: str, user_id: str) -> bool:
        if room_id not in self._users:
            return False
        if user_id not in self._users[room_id]:
            return False
        del self._users[room_id][user_id]
        return True

    def get_online_users(self, room_id: str) -> List[User]:
        users = self.get_users_by_room(room_id)
        return [u for u in users if u.is_online]


_user_service_instance: Optional[UserService] = None


def get_user_service() -> UserService:
    global _user_service_instance
    if _user_service_instance is None:
        _user_service_instance = UserService()
    return _user_service_instance
