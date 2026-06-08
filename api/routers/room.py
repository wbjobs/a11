from fastapi import APIRouter, Depends, HTTPException, status

from api.dependencies import (
    get_current_user,
    get_token_payload,
    TokenPayload,
)
from api.models.user import User, UserRole
from api.models.requests import (
    CreateRoomRequest,
    CreateRoomResponse,
    JoinRoomRequest,
    JoinRoomResponse,
)
from api.models.room import Room
from api.services.room_service import RoomService, get_room_service


router = APIRouter(prefix="/room", tags=["Room Management"])


@router.post(
    "/create",
    response_model=CreateRoomResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建房间",
    description="创建新的点云重建协作房间，返回房间ID、用户ID和认证token",
)
async def create_room(
    request: CreateRoomRequest,
    room_service: RoomService = Depends(get_room_service),
) -> CreateRoomResponse:
    if not request.username or not request.username.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required",
        )

    try:
        room, user, token = await room_service.create_room(request.username.strip())

        return CreateRoomResponse(
            room_id=room.roomId,
            user_id=user.userId,
            token=token,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create room: {str(e)}",
        ) from e


@router.post(
    "/join",
    response_model=JoinRoomResponse,
    status_code=status.HTTP_200_OK,
    summary="加入房间",
    description="加入已存在的协作房间，返回用户信息、房间成员列表和当前点云数据",
)
async def join_room(
    request: JoinRoomRequest,
    room_service: RoomService = Depends(get_room_service),
) -> JoinRoomResponse:
    if not request.room_id or not request.room_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room ID is required",
        )

    if not request.username or not request.username.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required",
        )

    try:
        result = await room_service.join_room(
            request.room_id.strip().upper(),
            request.username.strip(),
            request.role,
        )

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found",
            )

        user, token, users, point_cloud, annotations = result

        return JoinRoomResponse(
            user_id=user.userId,
            token=token,
            users=users,
            point_cloud=point_cloud,
            annotations=annotations,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to join room: {str(e)}",
        ) from e


@router.get(
    "/info",
    response_model=Room,
    status_code=status.HTTP_200_OK,
    summary="获取房间信息",
    description="获取当前房间的详细信息，需要Authorization header",
)
async def get_room_info(
    token_payload: TokenPayload = Depends(get_token_payload),
    room_service: RoomService = Depends(get_room_service),
    _: User = Depends(get_current_user),
) -> Room:
    room = await room_service.get_room(token_payload.room_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    return room
