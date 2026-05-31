"""AI moderation stub — replace with real model when ready."""
import re
from typing import Optional

STOP_WORDS = ["порно", "секс-услуги", "проститутк", "вебкам"]
LINK_PATTERN = re.compile(r"(https?://|www\.|t\.me/|@\w{3,})", re.IGNORECASE)
CONTACT_PATTERN = re.compile(r"\+?[0-9]{10,13}")


def moderate_text(text: Optional[str]) -> Optional[str]:
    """Block stop-words, links and contacts. Returns None if text is blocked."""
    if not text:
        return text
    lower = text.lower()
    for sw in STOP_WORDS:
        if sw in lower:
            return None
    if LINK_PATTERN.search(text):
        return None
    if CONTACT_PATTERN.search(text):
        return None
    return text


class NSFWModerationService:
    """
    Stub NSFW classifier. Returns a score in [0, 1].
    Replace the _classify method with a real model call (e.g. NudeNet, OpenNSFW2).
    Biometric data is never stored — only the score is persisted.
    """

    DEFAULT_THRESHOLD = 0.85
    STRICT_THRESHOLD = 0.70  # for 18+ room

    async def classify(self, media_url: str) -> float:
        """Stub: always returns 0.1 (safe). Real impl calls an ML model."""
        return 0.1

    async def is_nsfw(self, media_url: str, strict: bool = False) -> bool:
        score = await self.classify(media_url)
        threshold = self.STRICT_THRESHOLD if strict else self.DEFAULT_THRESHOLD
        return score >= threshold


nsfw_service = NSFWModerationService()


class FaceVerificationService:
    """
    Stub face liveness + embedding comparator.
    In prod: use FaceNet / DeepFace / Rekognition.
    Biometrics NOT stored — only pass/fail result.
    """

    async def verify_liveness(self, selfie_frames: list) -> bool:
        """Stub: always passes."""
        return True

    async def compare_with_profile(self, selfie_frames: list, profile_photo_url: str) -> bool:
        """Stub: cosine similarity check. Always passes in stub."""
        return True


face_service = FaceVerificationService()
