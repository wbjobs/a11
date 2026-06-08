import asyncio
import json
import uuid
from typing import Dict, Optional, Any, List
from fastapi import WebSocket, WebSocketDisconnect
import logging

from api.models import (
    WebSocketMessage,
    WebSocketMessageType,
    WebRTCSignal,
    User,
)

logger = logging.getLogger(__name__)


class WebSocketManager:
    _instance: Optional["WebSocketManager"] = None
    _lock = asyncio.Lock()

    def __new__(cls) -> "WebSocketManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized: bool = True
        self._connections: Dict[str, Dict[str, WebSocket]] = {}
        self._user_to_room: Dict[str, str] = {}
        self._pending_signals: Dict[str, List[Dict[str, Any]]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        room_id: str,
        user_id: str,
    ) -> None:
        async with self._lock:
            if room_id not in self._connections:
                self._connections[room_id] = {}
            self._connections[room_id][user_id] = websocket
            self._user_to_room[user_id] = room_id

            if user_id in self._pending_signals:
                for signal_data in self._pending_signals[user_id]:
                    await self._send_json(websocket, signal_data)
                del self._pending_signals[user_id]

        logger.info(f"User {user_id} connected to room {room_id}")

    async def disconnect(self, user_id: str) -> Optional[str]:
        async with self._lock:
            room_id = self._user_to_room.pop(user_id, None)
            if room_id and room_id in self._connections:
                self._connections[room_id].pop(user_id, None)
                if not self._connections[room_id]:
                    del self._connections[room_id]

        logger.info(f"User {user_id} disconnected from room {room_id}")
        return room_id

    async def broadcast_to_room(
        self,
        room_id: str,
        message_type: WebSocketMessageType,
        data: Any,
        exclude_user_ids: Optional[List[str]] = None,
    ) -> None:
        exclude_user_ids = exclude_user_ids or []
        message = WebSocketMessage(type=message_type, data=data)
        message_dict = message.model_dump(mode="json")

        async with self._lock:
            connections = self._connections.get(room_id, {})
            tasks = []
            for user_id, websocket in connections.items():
                if user_id not in exclude_user_ids:
                    tasks.append(self._send_json(websocket, message_dict))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_user(
        self,
        user_id: str,
        message_type: WebSocketMessageType,
        data: Any,
    ) -> bool:
        message = WebSocketMessage(type=message_type, data=data)
        message_dict = message.model_dump(mode="json")

        async with self._lock:
            room_id = self._user_to_room.get(user_id)
            if not room_id:
                return False
            connections = self._connections.get(room_id, {})
            websocket = connections.get(user_id)
            if not websocket:
                return False

        try:
            await self._send_json(websocket, message_dict)
            return True
        except Exception as e:
            logger.error(f"Failed to send message to user {user_id}: {e}")
            return False

    async def send_to_user_or_buffer(
        self,
        user_id: str,
        message_type: WebSocketMessageType,
        data: Any,
    ) -> None:
        sent = await self.send_to_user(user_id, message_type, data)
        if not sent:
            async with self._lock:
                if user_id not in self._pending_signals:
                    self._pending_signals[user_id] = []
                self._pending_signals[user_id].append({
                    "type": message_type.value,
                    "data": data,
                    "timestamp": asyncio.get_event_loop().time(),
                })

    async def handle_webrtc_signal(
        self,
        signal: WebRTCSignal,
        from_user: User,
    ) -> bool:
        to_user_id = signal.to_user_id
        message_type_map = {
            "offer": WebSocketMessageType.WEBRTC_OFFER,
            "answer": WebSocketMessageType.WEBRTC_ANSWER,
            "ice": WebSocketMessageType.WEBRTC_ICE,
        }
        message_type = message_type_map.get(signal.type)
        if not message_type:
            logger.warning(f"Unknown WebRTC signal type: {signal.type}")
            return False

        data = {
            "from": signal.from_user_id,
            "to": signal.to_user_id,
            signal.type: signal.data,
        }

        await self.send_to_user_or_buffer(to_user_id, message_type, data)
        logger.debug(
            f"Forwarded WebRTC {signal.type} from {signal.from_user_id} to {to_user_id}"
        )
        return True

    async def broadcast_user_join(
        self,
        room_id: str,
        user: User,
    ) -> None:
        user_data = user.model_dump(exclude={"token"})
        await self.broadcast_to_room(
            room_id,
            WebSocketMessageType.USER_JOIN,
            user_data,
            exclude_user_ids=[user.userId],
        )

    async def broadcast_user_leave(
        self,
        room_id: str,
        user_id: str,
    ) -> None:
        await self.broadcast_to_room(
            room_id,
            WebSocketMessageType.USER_LEAVE,
            {"userId": user_id},
        )

    async def broadcast_annotation(
        self,
        room_id: str,
        annotation: Any,
        action: str,
        exclude_user_id: Optional[str] = None,
    ) -> None:
        type_map = {
            "add": WebSocketMessageType.ANNOTATION_ADD,
            "update": WebSocketMessageType.ANNOTATION_UPDATE,
            "delete": WebSocketMessageType.ANNOTATION_DELETE,
        }
        message_type = type_map.get(action)
        if not message_type:
            raise ValueError(f"Invalid annotation action: {action}")

        data = (
            annotation.model_dump(mode="json")
            if action != "delete"
            else {"annotationId": annotation}
        )

        exclude = [exclude_user_id] if exclude_user_id else []
        await self.broadcast_to_room(room_id, message_type, data, exclude)

    async def broadcast_pointcloud(
        self,
        room_id: str,
        pointcloud_data: Any,
    ) -> None:
        data = pointcloud_data.model_dump(mode="json")
        await self.broadcast_to_room(
            room_id,
            WebSocketMessageType.POINTCLOUD_UPDATE,
            data,
        )

    async def broadcast_reconstruct_status(
        self,
        room_id: str,
        status_data: Any,
    ) -> None:
        data = status_data.model_dump(mode="json")
        await self.broadcast_to_room(
            room_id,
            WebSocketMessageType.RECONSTRUCT_STATUS,
            data,
        )

    def get_room_user_ids(self, room_id: str) -> List[str]:
        connections = self._connections.get(room_id, {})
        return list(connections.keys())

    def is_user_online(self, user_id: str) -> bool:
        room_id = self._user_to_room.get(user_id)
        if not room_id:
            return False
        connections = self._connections.get(room_id, {})
        return user_id in connections

    def get_room_connection_count(self, room_id: str) -> int:
        connections = self._connections.get(room_id, {})
        return len(connections)

    async def _send_json(
        self,
        websocket: WebSocket,
        data: Dict[str, Any],
    ) -> None:
        try:
            await websocket.send_json(data)
        except WebSocketDisconnect:
            logger.warning("WebSocket disconnected while sending message")
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            raise

    async def handle_message(
        self,
        websocket: WebSocket,
        user: User,
        message_handler: Optional[Any] = None,
    ) -> None:
        room_id = user.roomId
        user_id = user.userId

        try:
            while True:
                try:
                    data = await websocket.receive_json()
                    await self._process_message(data, user, message_handler)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON from user {user_id}")
                    continue
                except WebSocketDisconnect:
                    logger.info(f"WebSocket disconnected for user {user_id}")
                    break
        finally:
            await self.disconnect(user_id)
            if message_handler and hasattr(message_handler, "on_user_disconnect"):
                await message_handler.on_user_disconnect(room_id, user_id)

    async def _process_message(
        self,
        data: Dict[str, Any],
        user: User,
        message_handler: Optional[Any] = None,
    ) -> None:
        message_type = data.get("type")
        message_data = data.get("data", {})

        if not message_type:
            logger.warning(f"Message without type from user {user.userId}")
            return

        if message_type in ("webrtc_offer", "webrtc_answer", "webrtc_ice"):
            signal_type = message_type.replace("webrtc_", "")
            signal = WebRTCSignal(
                **{
                    "from": user.userId,
                    "to": message_data.get("to"),
                    "type": signal_type,
                    "data": message_data.get(signal_type),
                }
            )
            await self.handle_webrtc_signal(signal, user)
            return

        if message_handler and hasattr(message_handler, "handle_message"):
            await message_handler.handle_message(message_type, message_data, user)


def get_websocket_manager() -> WebSocketManager:
    return WebSocketManager()
