import os
import shutil
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    SERVER_HOST: str = Field(default="0.0.0.0", description="服务器监听地址")
    SERVER_PORT: int = Field(default=8000, description="服务器监听端口")

    BASE_DIR: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    PROJECT_ROOT: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent)
    UPLOAD_DIR: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "uploads")
    STATIC_DIR: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent / "static")

    COLMAP_PATH: Optional[str] = Field(
        default=None,
        description="COLMAP可执行文件路径，如未安装则为None",
    )

    MAX_UPLOAD_SIZE: int = Field(default=500 * 1024 * 1024, description="最大上传文件大小（字节）")
    ALLOWED_IMAGE_EXTENSIONS: set[str] = Field(
        default_factory=lambda: {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
    )

    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:3000", "*"]
    )

    @property
    def colmap_available(self) -> bool:
        if self.COLMAP_PATH is None:
            return False
        colmap_path = Path(self.COLMAP_PATH)
        return colmap_path.exists() and (colmap_path.is_file() or shutil.which(self.COLMAP_PATH) is not None)

    def ensure_directories(self) -> None:
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.STATIC_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
