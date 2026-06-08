from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from api.dependencies import get_current_user, get_token_payload, TokenPayload
from api.models.user import User
from api.models.requests import PointCloudHistoryResponse
from api.models.pointcloud import PointCloudVersion, PointCloudData
from api.services.pointcloud import PointCloudService, get_pointcloud_service
from api.services.room_service import RoomService, get_room_service


router = APIRouter(prefix="/pointcloud", tags=["Point Cloud"])


@router.get(
    "/history",
    response_model=PointCloudHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="获取点云历史版本",
    description="获取指定房间的点云重建历史版本列表，按版本号降序排列",
)
async def get_pointcloud_history(
    room_id: str = Query(..., description="房间ID", alias="roomId"),
    token_payload: TokenPayload = Depends(get_token_payload),
    _: User = Depends(get_current_user),
    pointcloud_service: PointCloudService = Depends(get_pointcloud_service),
    room_service: RoomService = Depends(get_room_service),
) -> PointCloudHistoryResponse:
    if room_id != token_payload.room_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: room ID does not match token",
        )

    room = room_service.get_room(room_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    try:
        versions = pointcloud_service.get_version_history(room_id)
        sorted_versions = sorted(versions, key=lambda v: v.version_number, reverse=True)
        return PointCloudHistoryResponse(versions=sorted_versions)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get point cloud history: {str(e)}",
        ) from e


@router.get(
    "/{version_id}",
    response_model=PointCloudData,
    status_code=status.HTTP_200_OK,
    summary="获取指定版本点云",
    description="获取指定版本ID对应的点云数据，包括点坐标、颜色和相机位姿",
)
async def get_pointcloud_version(
    version_id: str,
    token_payload: TokenPayload = Depends(get_token_payload),
    _: User = Depends(get_current_user),
    pointcloud_service=Depends(PointCloudService),
) -> PointCloudData:
    try:
        point_cloud = pointcloud_service.get_point_cloud_data(version_id)
        if point_cloud is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Point cloud version not found: {version_id}",
            )

        if point_cloud.room_id != token_payload.room_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: point cloud does not belong to your room",
            )

        return point_cloud
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get point cloud data: {str(e)}",
        ) from e


@router.get(
    "/latest",
    response_model=PointCloudData,
    status_code=status.HTTP_200_OK,
    summary="获取最新点云",
    description="获取当前房间的最新点云数据",
)
async def get_latest_pointcloud(
    token_payload: TokenPayload = Depends(get_token_payload),
    _: User = Depends(get_current_user),
    pointcloud_service: PointCloudService = Depends(get_pointcloud_service),
) -> PointCloudData:
    try:
        point_cloud = pointcloud_service.get_latest_point_cloud(token_payload.room_id)
        if point_cloud is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No point cloud data available for this room",
            )
        return point_cloud
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get latest point cloud: {str(e)}",
        ) from e
