from __future__ import annotations

import asyncio
import logging
import numpy as np
from contextlib import asynccontextmanager
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from api.core.config import settings
from api.services.room_service import RoomService, get_room_service
from api.services.annotation_service import AnnotationService, get_annotation_service
from api.services.websocket_manager import WebSocketManager, get_websocket_manager
from api.services.reconstruct_service import ReconstructionService
from api.models import (
    User,
    Annotation,
    ReconstructStatusData,
    WebSocketMessageType,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

room_service = get_room_service()
annotation_service = get_annotation_service()
ws_manager = get_websocket_manager()

reconstruct_services: Dict[str, ReconstructionService] = {}


def get_or_create_reconstruct_service(room_id: str) -> ReconstructionService:
    if room_id not in reconstruct_services:
        service = ReconstructionService(
            frames_per_reconstruction=8,
            max_versions=20,
        )
        service.register_callback(create_reconstruct_callback(room_id))
        reconstruct_services[room_id] = service
        asyncio.create_task(service.start())
    return reconstruct_services[room_id]


def create_reconstruct_callback(room_id: str):
    async def callback(message: dict):
        if message["type"] == "pointcloud":
            pc_data = message["data"]
            point_cloud_data = {
                "versionId": f"v{pc_data['version_id']}",
                "roomId": room_id,
                "timestamp": pc_data["timestamp"],
                "versionNumber": pc_data["version_id"],
                "points": pc_data["points"].flatten().tolist(),
                "colors": pc_data["colors"].flatten().tolist(),
                "pointCount": pc_data["num_points"],
            }
            await room_service.set_point_cloud(room_id, point_cloud_data)
            await ws_manager.broadcast_pointcloud(room_id, point_cloud_data)

        elif message["type"] == "progress":
            progress = message["data"]
            status_data = ReconstructStatusData(
                status=progress["status"],
                progress=progress["progress"],
                message=progress["message"],
                framesProcessed=progress.get("current_version", 0),
                totalFrames=progress.get("total_points", 100),
            )
            await ws_manager.broadcast_reconstruct_status(room_id, status_data.model_dump())

    return callback


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_directories()
    logger.info(f"COLMAP available: {settings.colmap_available}")
    yield
    for service in reconstruct_services.values():
        await service.stop()
    logger.info("Server shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title="点云重建协作系统 API",
        description="WebRTC联合WebGL的实时点云重建与协作标注系统后端API",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    from api.routers import get_room_router, get_frame_router, get_pointcloud_router

    api_prefix = "/api"
    app.include_router(get_room_router(), prefix=api_prefix)
    app.include_router(get_frame_router(), prefix=api_prefix)
    app.include_router(get_pointcloud_router(), prefix=api_prefix)

    @app.get("/health", tags=["Health"])
    async def health_check() -> dict:
        return {
            "status": "healthy",
            "colmapAvailable": settings.colmap_available,
            "activeRooms": len(reconstruct_services),
        }

    @app.websocket("/ws/{room_id}/{user_id}")
    async def websocket_endpoint(
        websocket: WebSocket,
        room_id: str,
        user_id: str,
    ):
        await websocket.accept()

        user = await room_service.get_user(room_id, user_id)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid user")
            return

        if user.roomId != room_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid room")
            return

        await ws_manager.connect(websocket, room_id, user_id)

        room = await room_service.get_room(room_id)
        if room:
            existing_users = await room_service.get_room_users(room_id)
            for u in existing_users:
                if u.userId != user_id:
                    await ws_manager.send_to_user(
                        u.userId,
                        WebSocketMessageType.USER_JOIN,
                        user.model_dump(mode="json"),
                    )

        try:
            while True:
                raw_data = await websocket.receive_text()
                try:
                    message = await ws_manager.handle_message(
                        websocket,
                        user,
                        annotation_service,
                    )
                    if message and message["type"] == "frame_data":
                        frame_bytes = message["data"]["frame"]
                        timestamp = message["data"]["timestamp"]
                        frame_index = message["data"]["frameIndex"]

                        try:
                            nparr = np.frombuffer(frame_bytes, np.uint8)
                            import cv2
                            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                            if img is not None:
                                recon_service = get_or_create_reconstruct_service(room_id)
                                await recon_service.add_frame(
                                    img,
                                    metadata={"frame_id": frame_index, "timestamp": timestamp},
                                )
                        except Exception as e:
                            logger.error(f"Frame processing error: {e}")

                except Exception as e:
                    logger.error(f"Message handling error: {e}")

        except WebSocketDisconnect:
            logger.info(f"User {user_id} disconnected")
            disconnected_room_id = await ws_manager.disconnect(user_id)
            if disconnected_room_id:
                await room_service.leave_room(disconnected_room_id, user_id)
                await ws_manager.broadcast_user_leave(disconnected_room_id, {"userId": user_id})

        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            await ws_manager.disconnect(user_id)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
