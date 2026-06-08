from typing import Dict, Optional, List
import uuid
import time

from api.models.annotation import Annotation, AnnotationType


class AnnotationService:
    def __init__(self):
        self._annotations: Dict[str, List[Annotation]] = {}

    def _get_or_create_annotations(self, room_id: str) -> List[Annotation]:
        if room_id not in self._annotations:
            self._annotations[room_id] = []
        return self._annotations[room_id]

    def add_annotation(
        self,
        room_id: str,
        user_id: str,
        user_name: str,
        point_cloud_version_id: str,
        annotation_type: AnnotationType,
        position: List[float],
        color: str,
        size: float,
        direction: Optional[List[float]] = None,
        text: Optional[str] = None,
    ) -> Annotation:
        now = int(time.time() * 1000)
        annotation_id = f"ann_{uuid.uuid4().hex[:8]}"

        annotation = Annotation(
            annotation_id=annotation_id,
            room_id=room_id,
            user_id=user_id,
            user_name=user_name,
            point_cloud_version_id=point_cloud_version_id,
            type=annotation_type,
            position=position,
            direction=direction,
            color=color,
            size=size,
            text=text,
            created_at=now,
            updated_at=now,
        )

        annotations = self._get_or_create_annotations(room_id)
        annotations.append(annotation)
        return annotation

    def get_annotations_by_room(self, room_id: str) -> List[Annotation]:
        return list(self._get_or_create_annotations(room_id))

    def get_annotations_by_version(
        self, room_id: str, version_id: str
    ) -> List[Annotation]:
        annotations = self._get_or_create_annotations(room_id)
        return [a for a in annotations if a.point_cloud_version_id == version_id]

    def get_annotation(self, room_id: str, annotation_id: str) -> Optional[Annotation]:
        annotations = self._get_or_create_annotations(room_id)
        for a in annotations:
            if a.annotation_id == annotation_id:
                return a
        return None

    def update_annotation(
        self,
        room_id: str,
        annotation_id: str,
        position: Optional[List[float]] = None,
        color: Optional[str] = None,
        size: Optional[float] = None,
        direction: Optional[List[float]] = None,
        text: Optional[str] = None,
    ) -> Optional[Annotation]:
        annotation = self.get_annotation(room_id, annotation_id)
        if annotation is None:
            return None

        if position is not None:
            annotation.position = position
        if color is not None:
            annotation.color = color
        if size is not None:
            annotation.size = size
        if direction is not None:
            annotation.direction = direction
        if text is not None:
            annotation.text = text

        annotation.updated_at = int(time.time() * 1000)
        return annotation

    def delete_annotation(self, room_id: str, annotation_id: str) -> bool:
        annotations = self._get_or_create_annotations(room_id)
        for i, a in enumerate(annotations):
            if a.annotation_id == annotation_id:
                del annotations[i]
                return True
        return False

    def delete_room_annotations(self, room_id: str) -> None:
        if room_id in self._annotations:
            del self._annotations[room_id]


_annotation_service_instance: Optional["AnnotationService"] = None


def get_annotation_service() -> "AnnotationService":
    global _annotation_service_instance
    if _annotation_service_instance is None:
        _annotation_service_instance = AnnotationService()
    return _annotation_service_instance
