import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.ai.providers.gemini_provider import GeminiProvider
from app.ai.providers.groq_provider import GroqProvider

logger = logging.getLogger(__name__)

# Standard technical casing corrections (safe exact phrase normalization)
TECHNICAL_TERM_CANONICAL = [
    (re.compile(r"\bfast\s+api\b", re.IGNORECASE), "FastAPI"),
    (re.compile(r"\bsequel\s*light\b", re.IGNORECASE), "SQLite"),
    (re.compile(r"\bpostgre\s*sql\b", re.IGNORECASE), "PostgreSQL"),
    (re.compile(r"\bpostgres\s*ql\b", re.IGNORECASE), "PostgreSQL"),
    (re.compile(r"\bnext\s*js\b", re.IGNORECASE), "Next.js"),
    (re.compile(r"\breact\s*js\b", re.IGNORECASE), "React"),
    (re.compile(r"\btailwind\s*css\b", re.IGNORECASE), "Tailwind CSS"),
    (re.compile(r"\btype\s*script\b", re.IGNORECASE), "TypeScript"),
    (re.compile(r"\bjava\s*script\b", re.IGNORECASE), "JavaScript"),
    (re.compile(r"\bassembly\s*ai\b", re.IGNORECASE), "AssemblyAI"),
    (re.compile(r"\bweb\s*socket\b", re.IGNORECASE), "WebSocket"),
    (re.compile(r"\bg\s*mail\b", re.IGNORECASE), "Gmail"),
]


class TranscriptCleanupService:
    """
    Performs light, conservative transcript cleanup:
    - Capitalization & punctuation formatting
    - Mild conversational filler trimming without losing semantic meaning
    - Standard technical term casing
    Strictly forbids hallucinating, guessing missing words, altering meaning,
    or merging/fabricating speakers.
    """

    def __init__(
        self,
        gemini_provider: Optional[GeminiProvider] = None,
        groq_provider: Optional[GroqProvider] = None,
    ):
        self.gemini_provider = gemini_provider or GeminiProvider()
        self.groq_provider = groq_provider or GroqProvider()

    @staticmethod
    def apply_technical_term_normalization(text: str) -> str:
        """Applies conservative deterministic technical terminology casing."""
        if not text:
            return ""
        result = text
        for pattern, canonical in TECHNICAL_TERM_CANONICAL:
            result = pattern.sub(canonical, result)
        return result

    def clean_segments(
        self,
        segments: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Takes raw aligned segments and enriches each with a cleaned_text field.
        Always preserves raw_text untouched.
        """
        if not segments:
            return []

        # 1. Deterministic technical term normalization on every segment
        for seg in segments:
            raw = seg.get("raw_text") or seg.get("text") or ""
            seg["raw_text"] = raw
            seg["cleaned_text"] = self.apply_technical_term_normalization(raw)
            seg["text"] = seg["cleaned_text"]

        if not getattr(settings, "ENABLE_TRANSCRIPT_CLEANUP", True):
            logger.info("[TranscriptCleanup] Cleanup disabled via config. Using normalized text.")
            return segments

        # 2. Batch lightweight punctuation & capitalization polish
        # Process in batches of 20 segments to keep latency low and output predictable
        batch_size = 20
        for i in range(0, len(segments), batch_size):
            chunk = segments[i : i + batch_size]
            payload = [
                {
                    "idx": j,
                    "speaker": s.get("speaker_name", "Participant"),
                    "text": s.get("cleaned_text", ""),
                }
                for j, s in enumerate(chunk)
            ]

            prompt = (
                "You are an executive audio transcription post-processor. "
                "Your task is LIGHT, conservative punctuation and capitalization formatting on the following meeting utterances.\n\n"
                "STRICT RULES:\n"
                "1. Fix obvious punctuation (periods, question marks, commas) and capitalize sentence starts.\n"
                "2. DO NOT invent or fabricate any content.\n"
                "3. DO NOT change the speaker, merge utterances, or alter the meaning of any sentence.\n"
                "4. DO NOT guess missing words. If a word or phrase is unclear or foreign, keep the exact word as-is.\n"
                "5. Return ONLY a valid JSON array matching this schema:\n"
                '[{"idx": 0, "cleaned_text": "..."}]\n\n'
                f"Input utterances:\n{json.dumps(payload, ensure_ascii=False)}"
            )

            system_instruction = (
                "You format punctuation and capitalization of spoken audio transcripts. "
                "Never add commentary. Output only JSON."
            )

            raw_resp = None
            if self.gemini_provider.is_available():
                try:
                    raw_resp = self.gemini_provider.generate_content(
                        prompt=prompt,
                        system_instruction=system_instruction,
                        json_mode=True,
                    )
                except Exception as e:
                    logger.debug(f"[TranscriptCleanup] Gemini attempt notice: {e}")

            if not raw_resp and self.groq_provider.is_available():
                try:
                    raw_resp = self.groq_provider.chat_completion(
                        prompt=prompt,
                        system_instruction=system_instruction,
                        json_mode=True,
                        model="llama-3.3-70b-versatile",
                    )
                except Exception as e:
                    logger.debug(f"[TranscriptCleanup] Groq attempt notice: {e}")

            if raw_resp:
                try:
                    cleaned_str = raw_resp.strip()
                    if cleaned_str.startswith("```json"):
                        cleaned_str = cleaned_str[7:]
                    if cleaned_str.startswith("```"):
                        cleaned_str = cleaned_str[3:]
                    if cleaned_str.endswith("```"):
                        cleaned_str = cleaned_str[:-3]
                    cleaned_str = cleaned_str.strip()

                    parsed = json.loads(cleaned_str)
                    if isinstance(parsed, list):
                        result_map = {item["idx"]: item.get("cleaned_text", "") for item in parsed if "idx" in item}
                        for j, s in enumerate(chunk):
                            new_text = result_map.get(j, "").strip()
                            # Guardrail: check length deviation (< 35% diff) to prevent truncation or hallucination
                            old_len = len(s["cleaned_text"])
                            if new_text and abs(len(new_text) - old_len) <= max(20, old_len * 0.35):
                                s["cleaned_text"] = new_text
                                s["text"] = new_text
                except Exception as e:
                    logger.warning(f"[TranscriptCleanup] JSON parse error, retaining raw text: {e}")

        logger.info(f"[TranscriptCleanup] Processed {len(segments)} segments successfully.")
        return segments

    @staticmethod
    def format_transcript_text(segments: List[Dict[str, Any]], use_cleaned: bool = True) -> str:
        """Formats segments into a canonical multi-speaker transcript block."""
        lines = []
        for seg in segments:
            speaker = seg.get("speaker_name") or seg.get("speaker") or "Unknown Speaker"
            text_field = "cleaned_text" if use_cleaned else "raw_text"
            text = (seg.get(text_field) or seg.get("text") or "").strip()
            if text:
                lines.append(f"{speaker}: {text}")
        return "\n".join(lines)


# Singleton
transcript_cleanup_service = TranscriptCleanupService()
