import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from app.ai.providers.gemini_provider import GeminiProvider
from app.ai.providers.groq_provider import GroqProvider
from app.ai.providers.local_provider import LocalProvider

logger = logging.getLogger(__name__)


# ── Pydantic Schemas for Strict AI Output Validation ─────────────────────────

class ActionItemSchema(BaseModel):
    task: str = Field(..., description="Actionable imperative task description")
    assignee: str = Field(default="Unassigned", description="Name of the person responsible")
    deadline: str = Field(default="ASAP", description="Due date or timeframe")
    priority: str = Field(default="Medium", description="High, Medium, or Low")


class MeetingIntelligenceSchema(BaseModel):
    title: str = Field(default="Meeting Sync", description="Concise 3-6 word professional title")
    executive_summary: str = Field(..., description="2-4 sentence executive summary")
    key_points: List[str] = Field(default_factory=list, description="List of primary discussion points")
    decisions: List[str] = Field(default_factory=list, description="Agreed decisions and resolutions")
    action_items: List[ActionItemSchema] = Field(default_factory=list, description="Structured action items")
    risks: List[str] = Field(default_factory=list, description="Identified technical/delivery risks or concerns")
    questions: List[str] = Field(default_factory=list, description="Unresolved questions or open points")
    next_steps: List[str] = Field(default_factory=list, description="Follow-up milestones and next steps")
    topics: List[str] = Field(default_factory=list, description="Key agenda topics discussed")


class SummaryService:
    """
    Orchestrates structured meeting intelligence extraction.
    Primary: Google Gemini Flash
    Fallback: Groq Llama 3.3
    Final Fallback: Local Provider (T5-small / heuristics)
    Supports semantic chunking for long transcripts (> 3000 words).
    """

    def __init__(
        self,
        gemini_provider: Optional[GeminiProvider] = None,
        groq_provider: Optional[GroqProvider] = None,
        local_provider: Optional[LocalProvider] = None,
    ):
        self.gemini_provider = gemini_provider or GeminiProvider()
        self.groq_provider = groq_provider or GroqProvider()
        self.local_provider = local_provider or LocalProvider()

    def generate_intelligence(
        self,
        transcript: str,
        participant_names: Optional[List[str]] = None,
    ) -> Tuple[Dict[str, Any], str]:
        """
        Generates structured meeting intelligence with multi-tier failover.
        Returns:
            (intelligence_dict, provider_used)
        """
        if not transcript or not transcript.strip():
            empty_data = MeetingIntelligenceSchema(
                title="Untitled Session",
                executive_summary="No transcribable audio or discussion recorded.",
            ).dict()
            return empty_data, "none"

        words = transcript.split()
        # Phase 10: Chunk long transcripts (> 3000 words, ~25-30 minutes of speech)
        if len(words) > 3000:
            logger.info(f"[SummaryService] Long transcript detected ({len(words)} words). Processing in semantic chunks.")
            return self._process_chunked_transcript(transcript, participant_names)

        # ── 1. Primary: Google Gemini Flash ───────────────────────────────
        if self.gemini_provider.is_available():
            try:
                res = self._call_provider_structured(
                    provider_type="gemini",
                    transcript=transcript,
                    participant_names=participant_names,
                )
                if res:
                    logger.info("[SummaryService] Successfully generated structured summary via Google Gemini.")
                    return res, "gemini"
            except Exception as e:
                logger.warning(f"[SummaryService] Gemini summarization failed: {e}. Falling back to Groq...")

        # ── 2. Fallback: Groq Llama 3.3 ───────────────────────────────────
        if self.groq_provider.is_available():
            try:
                res = self._call_provider_structured(
                    provider_type="groq",
                    transcript=transcript,
                    participant_names=participant_names,
                )
                if res:
                    logger.info("[SummaryService] Successfully generated structured summary via Groq Llama.")
                    return res, "groq_llama"
            except Exception as e:
                logger.warning(f"[SummaryService] Groq Llama summarization failed: {e}. Falling back to local...")

        # ── 3. Final Fallback: Local Heuristic / T5 ────────────────────────
        res = self.local_provider.summarize_text(transcript)
        return res, "local_fallback"

    def _build_prompt(
        self,
        transcript: str,
        participant_names: Optional[List[str]] = None,
    ) -> str:
        participants_hint = ""
        if participant_names:
            participants_hint = f"\nKnown meeting participants: {', '.join(participant_names)}"

        return (
            "You are an executive AI meeting intelligence engine. Analyze the meeting transcript below.\n"
            "Return a strictly valid JSON object matching this exact schema:\n"
            "{\n"
            '  "title": "Concise 3-6 word professional meeting title",\n'
            '  "executive_summary": "2-4 sentence high-impact summary synthesizing primary goals, deliverables, and outcome",\n'
            '  "key_points": ["Specific discussion point 1", "Specific discussion point 2", ...],\n'
            '  "decisions": ["Agreed decision 1 with context", "Agreed decision 2", ...],\n'
            '  "action_items": [\n'
            '    {\n'
            '      "task": "Imperative task description",\n'
            '      "assignee": "Name of responsible person or specific participant",\n'
            '      "deadline": "Timeframe or specific date/day (e.g. Tomorrow, Friday, Next Sprint)",\n'
            '      "priority": "High / Medium / Low"\n'
            '    }\n'
            '  ],\n'
            '  "risks": ["Identified bottleneck, dependency, or technical concern 1", ...],\n'
            '  "questions": ["Unresolved question or open item 1", ...],\n'
            '  "next_steps": ["Milestone or next step 1", ...],\n'
            '  "topics": ["High-level topic 1", "High-level topic 2", ...]\n'
            "}\n"
            f"{participants_hint}\n\n"
            f"Transcript:\n{transcript}"
        )

    def _call_provider_structured(
        self,
        provider_type: str,
        transcript: str,
        participant_names: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        prompt = self._build_prompt(transcript, participant_names)
        system_instruction = "Output only the raw JSON object matching the requested schema. Do not output markdown code blocks."

        raw_output = None
        if provider_type == "gemini":
            raw_output = self.gemini_provider.generate_content(
                prompt=prompt,
                system_instruction=system_instruction,
                json_mode=True,
            )
        elif provider_type == "groq":
            raw_output = self.groq_provider.chat_completion(
                prompt=prompt,
                system_instruction=system_instruction,
                json_mode=True,
                model="llama-3.3-70b-versatile",
            )

        if not raw_output:
            return None

        # Clean JSON markdown if model wrapped it
        cleaned = raw_output.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
        except Exception:
            # Attempt substring match for curly braces
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    parsed = json.loads(cleaned[start:end+1])
                except Exception:
                    return None
            else:
                return None

        # Validate with Pydantic
        validated = MeetingIntelligenceSchema(**parsed)
        return validated.dict()

    def _process_chunked_transcript(
        self,
        transcript: str,
        participant_names: Optional[List[str]] = None,
    ) -> Tuple[Dict[str, Any], str]:
        """
        Chunks long transcripts at speaker/sentence boundaries,
        generates section summaries, and synthesizes into a cohesive final output.
        """
        paragraphs = transcript.split("\n\n")
        chunks = []
        current_chunk = []
        current_words = 0

        for p in paragraphs:
            w_count = len(p.split())
            if current_words + w_count > 2000 and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = [p]
                current_words = w_count
            else:
                current_chunk.append(p)
                current_words += w_count
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        logger.info(f"[SummaryService] Chunked transcript into {len(chunks)} sections.")

        chunk_summaries = []
        for i, chunk in enumerate(chunks):
            chunk_prompt = f"Summarize section {i+1} of this meeting concisely in 4-6 bullet points:\n{chunk}"
            text = None
            if self.gemini_provider.is_available():
                text = self.gemini_provider.generate_content(chunk_prompt, json_mode=False)
            if not text and self.groq_provider.is_available():
                text = self.groq_provider.chat_completion(chunk_prompt)
            if text:
                chunk_summaries.append(text.strip())

        combined_context = "\n\n---\n\n".join(chunk_summaries)
        # Final synthesis with the full schema
        synthesis_prompt = (
            f"The following are chronological section summaries from a long meeting:\n\n{combined_context}\n\n"
            f"Synthesize these into a cohesive, structured meeting intelligence output."
        )

        res = None
        if self.gemini_provider.is_available():
            try:
                res = self._call_provider_structured("gemini", synthesis_prompt, participant_names)
            except Exception:
                pass
        if not res and self.groq_provider.is_available():
            try:
                res = self._call_provider_structured("groq", synthesis_prompt, participant_names)
            except Exception:
                pass

        if res:
            return res, "chunked_synthesis"

        return self.local_provider.summarize_text(transcript), "local_fallback"
