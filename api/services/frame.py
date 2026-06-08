from typing import Dict, Optional, Tuple
import asyncio
import time
from dataclasses import dataclass


@dataclass
class FrameData:
    room_id: str
    user_id: str
    timestamp: int
    frame_index: int
    frame_bytes: bytes
    content_type: str


class FrameService:
    def __init__(self, max_queue_size: int = 1000):
        self._queues: Dict[str, asyncio.Queue[FrameData]] = {}
        self._max_queue_size = max_queue_size
        self._frame_counts: Dict[str, int] = {}

    def _get_or_create_queue(self, room_id: str) -> asyncio.Queue[FrameData]:
        if room_id not in self._queues:
            self._queues[room_id] = asyncio.Queue(maxsize=self._max_queue_size)
            self._frame_counts[room_id] = 0
        return self._queues[room_id]

    async def enqueue_frame(
        self,
        room_id: str,
        user_id: str,
        timestamp: int,
        frame_index: int,
        frame_bytes: bytes,
        content_type: str,
    ) -> Tuple[bool, Optional[str]]:
        queue = self._get_or_create_queue(room_id)

        if queue.full():
            return False, "Frame queue is full, dropping frame"

        frame_data = FrameData(
            room_id=room_id,
            user_id=user_id,
            timestamp=timestamp,
            frame_index=frame_index,
            frame_bytes=frame_bytes,
            content_type=content_type,
        )

        try:
            queue.put_nowait(frame_data)
            self._frame_counts[room_id] += 1
            return True, None
        except asyncio.QueueFull:
            return False, "Frame queue is full, dropping frame"

    async def dequeue_frame(self, room_id: str) -> Optional[FrameData]:
        if room_id not in self._queues:
            return None
        queue = self._queues[room_id]
        if queue.empty():
            return None
        try:
            return queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    def get_queue_size(self, room_id: str) -> int:
        if room_id not in self._queues:
            return 0
        return self._queues[room_id].qsize()

    def get_total_frames_processed(self, room_id: str) -> int:
        return self._frame_counts.get(room_id, 0)

    def clear_queue(self, room_id: str) -> None:
        if room_id in self._queues:
            while not self._queues[room_id].empty():
                try:
                    self._queues[room_id].get_nowait()
                except asyncio.QueueEmpty:
                    break

    def delete_room_queue(self, room_id: str) -> None:
        if room_id in self._queues:
            del self._queues[room_id]
        if room_id in self._frame_counts:
            del self._frame_counts[room_id]


_frame_service_instance: Optional["FrameService"] = None


def get_frame_service() -> "FrameService":
    global _frame_service_instance
    if _frame_service_instance is None:
        _frame_service_instance = FrameService()
    return _frame_service_instance
