import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

DEFAULT_SHEET_ID = "1_rP5g4yHA56AMf7qHCoxSFmN5Ba2kIlpMSBHCiWaaJs"


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "Community Gaming Verification API")
    ENV: str = os.getenv("ENV", "development")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key")

    REGISTRAR_PASSWORD: str = os.getenv("REGISTRAR_PASSWORD", "REG_PASS_2026")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "ADMIN_OP_99")
    SUPER_ADMIN_PASSWORD: str = os.getenv("SUPER_ADMIN_PASSWORD", "SUPER_ADMIN_2026")

    YT_API_KEY: str = os.getenv("YT_API_KEY", "AIzaSyCGMs8CFuVth2eJkUQ4SUWfer4k0hUIGdc")
    SHEET_ID: str = os.getenv("SHEET_ID", DEFAULT_SHEET_ID)
    SHEET_TAB: str = os.getenv("SHEET_TAB", "Players")
    SERVICE_ACCOUNT_FILE: str = os.getenv("SERVICE_ACCOUNT_FILE", "credentials.json")
    GOOGLE_CREDENTIALS_JSON: str = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    LOCAL_STORE_FILE: str = os.getenv("LOCAL_STORE_FILE", "local_players.json")

    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
        ).split(",")
        if origin.strip()
    ]

    TOKEN_TTL_SECONDS: int = int(os.getenv("TOKEN_TTL_SECONDS", "43200"))

    PAYOUT_LEVEL_1: int = int(os.getenv("PAYOUT_LEVEL_1", "100"))
    PAYOUT_LEVEL_2: int = int(os.getenv("PAYOUT_LEVEL_2", "500"))
    PAYOUT_LEVEL_3: int = int(os.getenv("PAYOUT_LEVEL_3", "1500"))
    PAYOUT_LEVEL_4: int = int(os.getenv("PAYOUT_LEVEL_4", "5000"))
    PAYOUT_LEVEL_5: int = int(os.getenv("PAYOUT_LEVEL_5", "10000"))
    PAYOUT_LEVEL_6: int = int(os.getenv("PAYOUT_LEVEL_6", "25000"))
    PAYOUT_LEVEL_7: int = int(os.getenv("PAYOUT_LEVEL_7", "50000"))
    PAYOUT_LEVEL_8: int = int(os.getenv("PAYOUT_LEVEL_8", "100000"))
    PAYOUT_LEVEL_9: int = int(os.getenv("PAYOUT_LEVEL_9", "1000000"))

    @property
    def payout_map(self) -> dict[str, int]:
        return {
            "Level 1": self.PAYOUT_LEVEL_1,
            "Level 2": self.PAYOUT_LEVEL_2,
            "Level 3": self.PAYOUT_LEVEL_3,
            "Level 4": self.PAYOUT_LEVEL_4,
            "Level 5": self.PAYOUT_LEVEL_5,
            "Level 6": self.PAYOUT_LEVEL_6,
            "Level 7": self.PAYOUT_LEVEL_7,
            "Level 8": self.PAYOUT_LEVEL_8,
            "Level 9": self.PAYOUT_LEVEL_9,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
