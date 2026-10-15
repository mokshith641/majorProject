import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.transcription.corrector import phonetic_corrector

logger = logging.getLogger(__name__)


class LocalProvider:
    """
    Fallback-Only Local Provider.
    Runs faster-whisper and T5-small ONLY when all primary cloud APIs fail.
    Models are loaded lazily on-demand to conserve RAM and CPU.
    """

    def __init__(self):
        self._whisper_model = None
        self._t5_model = None
        self._t5_tokenizer = None

    def _get_whisper_model(self):
        if self._whisper_model is None:
            from faster_whisper import WhisperModel
            model_name = getattr(settings, "WHISPER_MODEL_NAME", "tiny.en")
            device = getattr(settings, "WHISPER_DEVICE", "cpu")
            compute_type = getattr(settings, "WHISPER_COMPUTE_TYPE", "int8") if device == "cpu" else "float16"
            download_root = "./whisper_models"
            os.makedirs(download_root, exist_ok=True)
            threads = min(8, max(2, (os.cpu_count() or 4) - 1))
            logger.info(f"[LocalProvider] Lazily loading faster-whisper model '{model_name}' on {device} ({compute_type})...")
            self._whisper_model = WhisperModel(
                model_name,
                device=device,
                compute_type=compute_type,
                cpu_threads=threads,
                num_workers=2,
                download_root=download_root,
            )
        return self._whisper_model

    def _get_t5(self):
        if self._t5_model is None or self._t5_tokenizer is None:
            from transformers import T5ForConditionalGeneration, T5Tokenizer
            logger.info("[LocalProvider] Lazily loading local T5-small model...")
            self._t5_tokenizer = T5Tokenizer.from_pretrained("t5-small")
            self._t5_model = T5ForConditionalGeneration.from_pretrained("t5-small")
        return self._t5_model, self._t5_tokenizer

    def transcribe_audio(
        self,
        audio_path: str,
        language: Optional[str] = "en",
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Runs faster-whisper locally on CPU."""
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        logger.info(f"[LocalProvider] Running local fallback transcription on '{audio_path}'...")
        start_t = time.time()
        model = self._get_whisper_model()

        segments_iter, _ = model.transcribe(
            audio_path,
            beam_size=1,
            best_of=1,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=300, speech_pad_ms=150),
            language=language if language and language != "auto" else "en",
        )

        full_text_list = []
        segment_list = []

        for seg in segments_iter:
            clean_text = seg.text.strip()
            if not clean_text:
                continue
            corrected = phonetic_corrector.correct_text(clean_text)
            full_text_list.append(corrected)
            segment_list.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": corrected,
                "confidence": 0.85,
            })

        duration = time.time() - start_t
        full_text = " ".join(full_text_list)
        logger.info(f"[LocalProvider] Local transcription completed in {duration:.2f}s ({len(segment_list)} segments).")
        return full_text, segment_list

    def summarize_text(self, transcript: str) -> Dict[str, Any]:
        """Runs local heuristic + T5 fallback summarizer."""
        if (
            not transcript
            or not transcript.strip()
            or transcript.strip() in [
                "No speech detected. Please record again.",
                "No speech recorded.",
                "No discussion recorded.",
                "No transcribable audio or discussion recorded.",
            ]
        ):
            return {
                "title": "Meeting Summary",
                "executive_summary": "No speech detected. Please record again.",
                "key_points": [],
                "decisions": [],
                "action_items": [],
                "risks": [],
                "questions": [],
                "next_steps": [],
                "topics": [],
            }

        logger.info("[LocalProvider] Running local heuristic summarizer fallback...")
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', transcript) if s.strip()]

        key_points = []
        decisions = []
        action_items = []
        risks = []
        next_steps = []

        for s in sentences:
            sl = s.lower()
            if any(k in sl for k in ["decided", "agreed", "consensus", "approved", "chosen"]):
                decisions.append(s)
            elif any(k in sl for k in ["risk", "blocker", "bottleneck", "issue", "concern", "delay"]):
                risks.append(s)
            elif any(k in sl for k in ["will", "need to", "action", "task", "assign", "follow up", "todo"]):
                action_items.append({
                    "task": s,
                    "assignee": "Team",
                    "deadline": "Next Meeting",
                    "priority": "Medium",
                })
            elif any(k in sl for k in ["next", "upcoming", "milestone", "schedule", "plan"]):
                next_steps.append(s)
            elif len(s.split()) >= 6:
                key_points.append(s)

        # Ensure sensible defaults if pattern matches are sparse
        if not key_points:
            key_points = sentences[:4] if sentences else ["Team discussion concluded."]
        if not decisions:
            decisions = ["Team reviewed active agenda items and aligned on direction."]
        if not risks:
            risks = ["No active blockers or critical risks raised."]
        if not next_steps:
            next_steps = ["Continue progress on current milestones."]

        # Use T5 neural summarization for executive summary if text is substantial
        exec_summary = ""
        if len(transcript.split()) >= 15:
            try:
                import torch
                t5_model, t5_tokenizer = self._get_t5()
                inputs = t5_tokenizer.encode(
                    "summarize: " + transcript[:1500],
                    return_tensors="pt",
                    max_length=512,
                    truncation=True,
                )
                with torch.inference_mode():
                    outputs = t5_model.generate(
                        inputs,
                        max_length=120,
                        min_length=30,
                        num_beams=2,
                        length_penalty=1.0,
                        early_stopping=True,
                    )
                exec_summary = t5_tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
            except Exception as e:
                logger.warning(f"[LocalProvider] T5 summarization error: {e}. Falling back to heuristic summary.")

        if not exec_summary:
            exec_summary = " ".join(sentences[:3]) if sentences else "Session concluded successfully."

        return {
            "title": "Meeting Sync & Action Review",
            "executive_summary": exec_summary,
            "key_points": key_points[:6],
            "decisions": decisions[:4],
            "action_items": action_items[:6],
            "risks": risks[:4],
            "questions": [],
            "next_steps": next_steps[:4],
            "topics": ["Sprint Progress", "Operations"],
        }
