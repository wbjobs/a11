from typing import Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    File,
    Form,
    UploadFile,
)

from api.dependencies import (
    get_current_user,
    get_room_id_header,
    TokenPayload,
    get_token_payload,
)
from api.models.user import User
from api.models.requests import FrameUploadResponse
from api.services.frame import FrameService, get_frame_service
from api.services.room_service import RoomService, get_room_service


router = APIRouter(prefix="/frame", tags=["Frame Upload"])


ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/octet-stream",
}

MAX_FRAME_SIZE = 10 * 1024 * 1024


@router.post(
    "/upload",
    response_model=FrameUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="上传视频帧",
    description="接收multipart/form-data格式的视频帧，存入处理队列。需要Authorization和Room-Id header。",
)
async def upload_frame(
    frame: UploadFile = File(..., description="视频帧图片文件"),
    timestamp: float = Form(..., description="帧时间戳(毫秒)"),
    frame_index: int = Form(..., description="帧序号"),
    token_payload: TokenPayload = Depends(get_token_payload),
    room_id_header: str = Depends(get_room_id_header),
    current_user: User = Depends(get_current_user),
    frame_service: FrameService = Depends(get_frame_service),
    room_service: RoomService = Depends(get_room_service),
) -> FrameUploadResponse:
    if room_id_header != token_payload.room_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room-Id header does not match token",
        )

    room = await room_service.get_room(token_payload.room_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    if current_user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewer role cannot upload frames",
        )

    if frame.content_type and frame.content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type: {frame.content_type}. "
            f"Allowed types: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    if timestamp <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Timestamp must be a positive number",
        )

    if frame_index < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Frame index must be non-negative",
        )

    try:
        frame_bytes = await frame.read()

        if len(frame_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty frame file",
            )

        if len(frame_bytes) > MAX_FRAME_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Frame size exceeds maximum limit of {MAX_FRAME_SIZE // 1024 // 1024}MB",
            )

        content_type = frame.content_type or "application/octet-stream"

        success, message = await frame_service.enqueue_frame(
            room_id=token_payload.room_id,
            user_id=current_user.user_id,
            timestamp=int(timestamp),
            frame_index=frame_index,
            frame_bytes=frame_bytes,
            content_type=content_type,
        )

        return FrameUploadResponse(
            success=success,
            queued=success,
            message=message,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process frame: {str(e)}",
        ) from e
    finally:
        await frame.close()


@router.get(
    "/queue-status",
    status_code=status.HTTP_200_OK,
    summary="获取帧队列状态",
    description="获取当前房间的帧队列状态信息",
)
async def get_queue_status(
    token_payload: TokenPayload = Depends(get_token_payload),
    _: User = Depends(get_current_user),
    frame_service: FrameService = Depends(get_frame_service),
) -> dict:
    return {
        "room_id": token_payload.room_id,
        "queue_size": frame_service.get_queue_size(token_payload.room_id),
        "total_frames_processed": frame_service.get_total_frames_processed(
            token_payload.room_id
        ),
    }
