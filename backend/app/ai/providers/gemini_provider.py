import json
import logging
import os
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiProvider:
    """
    Google Gemini Cloud Provider for structured meeting intelligence and title generation.
    Primary engine for high-speed executive summaries and multi-dimensional analysis.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = (
            api_key
            or getattr(settings, "GEMINI_API_KEY", "")
            or os.environ.get("GEMINI_API_KEY", "")
        )
        self.models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

    def is_available(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def generate_content(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = True,
        retries: int = 2,
    ) -> Optional[str]:
        """
        Sends generation request to Gemini Flash models with fallback across model versions.
        """
        if not self.is_available():
            logger.warning("[GeminiProvider] GEMINI_API_KEY not set.")
            return None

        last_error = None
        for attempt in range(retries + 1):
            for model in self.models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
                    req_data: Dict[str, Any] = {
                        "contents": [
                            {
                                "role": "user",
                                "parts": [{"text": prompt}],
                            }
                        ],
                        "generationConfig": {
                            "temperature": 0.2,
                        },
                    }
                    if system_instruction:
                        req_data["systemInstruction"] = {
                            "parts": [{"text": system_instruction}]
                        }
                    if json_mode:
                        req_data["generationConfig"]["responseMimeType"] = "application/json"

                    body = json.dumps(req_data).encode("utf-8")
                    req = urllib.request.Request(
                        url,
                        data=body,
                        headers={"Content-Type": "application/json"},
                        method="POST",
                    )
                    with urllib.request.urlopen(req, timeout=35) as resp:
                        if resp.status == 200:
                            data = json.loads(resp.read().decode("utf-8"))
                            candidates = data.get("candidates", [])
                            if candidates and "content" in candidates[0]:
                                parts = candidates[0]["content"].get("parts", [])
                                if parts and "text" in parts[0]:
                                    text = parts[0]["text"]
                                    if text and text.strip():
                                        logger.info(f"[GeminiProvider] Successfully generated response with {model}.")
                                        return text.strip()
                except Exception as e:
                    last_error = e
                    # If 403 or invalid key, don't loop endlessly
                    err_s = str(e).lower()
                    if "403" in err_s or "invalid api key" in err_s:
                        logger.error(f"[GeminiProvider] Permanent API key error: {e}")
                        return None
                    logger.debug(f"[GeminiProvider] Model {model} attempt error: {e}")
                    continue

            if attempt < retries:
                time.sleep((attempt + 1) * 2)

        logger.warning(f"[GeminiProvider] All Gemini models exhausted. Error: {last_error}")
        return None
