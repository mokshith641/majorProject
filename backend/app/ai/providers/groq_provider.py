import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple
from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)

# Default domain vocabulary to guide Groq Whisper's technical context
DEFAULT_DOMAIN_VOCABULARY = [
    "Artificial Intelligence",
    "Machine Learning",
    "FastAPI",
    "React",
    "PostgreSQL",
    "SQLite",
    "AssemblyAI",
    "Groq",
    "Google Gemini",
    "Whisper",
    "TensorFlow",
    "PyTorch",
    "Python",
    "JavaScript",
    "TypeScript",
    "Docker",
    "Kubernetes",
    "Next.js",
    "REST API",
    "WebSocket",
]


class GroqProvider:
    """
    High-performance Groq Cloud Speech-to-Text and LLM Provider.
    Primary engine for ultra-fast audio transcription.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = (
            api_key
            or getattr(settings, "GROQ_API_KEY", "")
            or os.environ.get("GROQ_API_KEY", "")
        )
        self._client: Optional[Groq] = None

    def is_available(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def _get_client(self) -> Groq:
        if self._client is None:
            if not self.is_available():
                raise ValueError("GROQ_API_KEY is not configured.")
            self._client = Groq(api_key=self.api_key.strip())
        return self._client

    def transcribe_audio(
        self,
        audio_path: str,
        mode: str = "fast",  # "fast" (whisper-large-v3-turbo) or "accurate" (whisper-large-v3)
        language: Optional[str] = None,
        custom_prompt: Optional[str] = None,
        retries: int = 2,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Transcribes audio using Groq Whisper.
        - Fast Mode: whisper-large-v3-turbo (default, ~3x faster)
        - Accurate Mode: whisper-large-v3
        Returns:
            (full_text, segments_list) where segments have start, end, text, confidence.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        client = self._get_client()
        model_name = "whisper-large-v3-turbo" if mode != "accurate" else "whisper-large-v3"
        
        # Build prompt context from domain vocabulary
        prompt_vocab = list(DEFAULT_DOMAIN_VOCABULARY)
        if custom_prompt:
            prompt_vocab.append(custom_prompt)
        prompt_str = ", ".join(prompt_vocab)[:800]  # Groq prompt limit safety

        last_error = None
        for attempt in range(retries + 1):
            try:
                logger.info(
                    f"[GroqProvider] Transcribing '{os.path.basename(audio_path)}' with model '{model_name}' "
                    f"(language={language or 'auto'}, attempt {attempt + 1})..."
                )
                start_t = time.time()
                with open(audio_path, "rb") as af:
                    kwargs: Dict[str, Any] = {
                        "file": (os.path.basename(audio_path), af),
                        "model": model_name,
                        "response_format": "verbose_json",
                        "temperature": 0.0,
                    }
                    if language and language.lower() not in ["auto", ""]:
                        kwargs["language"] = language.lower()
                    if prompt_str:
                        kwargs["prompt"] = prompt_str

                    transcription = client.audio.transcriptions.create(**kwargs)

                duration = time.time() - start_t
                raw_segments = getattr(transcription, "segments", []) or []
                full_text = getattr(transcription, "text", "") or ""

                parsed_segments: List[Dict[str, Any]] = []
                for s in raw_segments:
                    start_s = getattr(s, "start", 0.0) if not isinstance(s, dict) else s.get("start", 0.0)
                    end_s = getattr(s, "end", 0.0) if not isinstance(s, dict) else s.get("end", 0.0)
                    text_s = (getattr(s, "text", "") if not isinstance(s, dict) else s.get("text", "")).strip()
                    avg_logprob = getattr(s, "avg_logprob", None) if not isinstance(s, dict) else s.get("avg_logprob")
                    
                    if not text_s:
                        continue
                    
                    confidence = 0.95
                    if avg_logprob is not None:
                        # Convert log-probability to roughly 0..1 scale
                        import math
                        try:
                            confidence = round(math.exp(max(-5.0, min(0.0, float(avg_logprob)))), 2)
                        except Exception:
                            confidence = 0.95

                    parsed_segments.append({
                        "start": round(float(start_s), 2),
                        "end": round(float(end_s), 2),
                        "text": text_s,
                        "confidence": confidence,
                    })

                if not full_text and parsed_segments:
                    full_text = " ".join(s["text"] for s in parsed_segments)

                logger.info(
                    f"[GroqProvider] Transcription succeeded in {duration:.2f}s "
                    f"({len(parsed_segments)} segments, {len(full_text.split())} words)."
                )
                return full_text.strip(), parsed_segments

            except Exception as e:
                last_error = e
                # Don't retry client 400 errors or authentication errors
                err_msg = str(e).lower()
                if "authentication" in err_msg or "unauthorized" in err_msg or "invalid api key" in err_msg:
                    logger.error(f"[GroqProvider] Permanent auth error: {e}")
                    raise e
                if attempt < retries:
                    backoff = (attempt + 1) * 2
                    logger.warning(f"[GroqProvider] Attempt {attempt + 1} failed: {e}. Retrying in {backoff}s...")
                    time.sleep(backoff)
                else:
                    logger.error(f"[GroqProvider] All {retries + 1} attempts failed: {e}")
                    raise last_error

        raise last_error or RuntimeError("Groq transcription failed.")

    def chat_completion(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = False,
        model: str = "llama-3.3-70b-versatile",
    ) -> Optional[str]:
        """Runs Groq Llama LLM chat completion as fallback."""
        if not self.is_available():
            return None
        client = self._get_client()
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        models = [model, "llama-3.1-8b-instant"]
        for m in models:
            try:
                kwargs: Dict[str, Any] = {
                    "messages": messages,
                    "model": m,
                    "temperature": 0.2,
                }
                if json_mode:
                    kwargs["response_format"] = {"type": "json_object"}
                resp = client.chat.completions.create(**kwargs)
                content = resp.choices[0].message.content
                if content and content.strip():
                    return content.strip()
            except Exception as e:
                logger.warning(f"[GroqProvider] LLM call with {m} failed: {e}")
                continue
        return None
