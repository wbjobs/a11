from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from api.models.user import User, UserRole
from api.services.room import RoomService
from api.services.user import UserService


security = HTTPBearer(auto_error=False)


class TokenPayload:
    def __init__(self, user_id: str, room_id: str, role: UserRole):
        self.user_id = user_id
        self.room_id = room_id
        self.role = role


def _parse_token(token: str) -> TokenPayload:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token format")
        import base64
        import json
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
        return TokenPayload(
            user_id=payload["userId"],
            room_id=payload["roomId"],
            role=UserRole(payload["role"]),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def get_token_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> TokenPayload:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _parse_token(credentials.credentials)


async def get_current_user(
    token_payload: TokenPayload = Depends(get_token_payload),
    user_service=Depends(UserService),
    room_service=Depends(RoomService),
) -> User:
    room = room_service.get_room(token_payload.room_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    user = user_service.get_user(token_payload.room_id, token_payload.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in room",
        )

    if not user.is_online:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is offline",
        )

    return user


async def get_room_id_header(
    room_id: Optional[str] = Header(None, alias="Room-Id"),
) -> str:
    if room_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room-Id header is required",
        )
    return room_id


def generate_token(user_id: str, room_id: str, role: UserRole) -> str:
    import base64
    import json
    import time
    import hashlib

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "userId": user_id,
        "roomId": room_id,
        "role": role.value,
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 7,
    }
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=").decode()
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    signature = hashlib.sha256(f"{header_b64}.{payload_b64}.secret".encode()).hexdigest()
    return f"{header_b64}.{payload_b64}.{signature}"
