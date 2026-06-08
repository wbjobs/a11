def get_room_router():
    from api.routers.room import router
    return router


def get_frame_router():
    from api.routers.frame import router
    return router


def get_pointcloud_router():
    from api.routers.pointcloud import router
    return router


__all__ = [
    "get_room_router",
    "get_frame_router",
    "get_pointcloud_router",
]
