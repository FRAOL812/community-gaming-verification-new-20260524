from pydantic import BaseModel, Field
from typing import Literal, Optional


class LoginRequest(BaseModel):
    role: Literal["registrar", "admin", "super_admin"]
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    token: str
    role: Literal["registrar", "admin", "super_admin"]


class VerifyRequest(BaseModel):
    youtube_handle: str = Field(min_length=2, max_length=120)


class VerifyResponse(BaseModel):
    status: Literal["not_found", "already_played", "ready"]
    color: Literal["red", "yellow", "green"]
    message: str
    youtube_handle: str
    channel_id: Optional[str] = None
    channel_title: Optional[str] = None
    sheet_row: Optional[int] = None


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: str = Field(min_length=4, max_length=180)
    phone_number: str = Field(min_length=5, max_length=40)
    youtube_handle: str = Field(min_length=2, max_length=120)
    channel_id: Optional[str] = None
    channel_title: Optional[str] = None


class Player(BaseModel):
    row_number: int
    timestamp: str = ""
    full_name: str = ""
    email: str = ""
    phone_number: str = ""
    youtube_handle: str = ""
    channel_id: str = ""
    channel_title: str = ""
    verification_status: str = ""
    exit_level: str = ""
    result_status: str = ""
    winnings: str = ""
    telebirr_ref: str = ""
    updated_at: str = ""


class RegisterResponse(BaseModel):
    ok: bool
    message: str
    player: Player


class ResultRequest(BaseModel):
    exit_level: Literal[
        "Level 1",
        "Level 2",
        "Level 3",
        "Level 4",
        "Level 5",
        "Level 6",
        "Level 7",
        "Level 8",
        "Level 9",
    ]
    status: Literal["Won", "Fell"]
    telebirr_ref: str = Field(default="", max_length=120)


class ResultResponse(BaseModel):
    ok: bool
    message: str
    row_number: int
    winnings: int


class StatusUpdateRequest(BaseModel):
    verification_status: Literal["Completed", "Failed", "Disqualified", "Pending"]


class StatusUpdateResponse(BaseModel):
    ok: bool
    message: str
    row_number: int
    verification_status: str
