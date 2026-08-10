import json
import logging
import re
from typing import Dict, List, Optional

import torch
from transformers import T5ForConditionalGeneration, T5Tokenizer

from app.core.config import settings

logger = logging.getLogger(__name__)


def split_into_sentences(text: str) -> List[str]:
    """Helper to split text into clean sentences, preserving common abbreviations."""
    abbrs = {
        "e.g.": "e_g_",
        "i.e.": "i_e_",
        "vs.": "vs_",
        "mr.": "mr_",
        "ms.": "ms_",
        "dr.": "dr_",
        "etc.": "etc_",
        "tbd.": "tbd_",
        "a.m.": "a_m_",
        "p.m.": "p_m_"
    }
    
    temp_text = text
    for abbr, placeholder in abbrs.items():
        temp_text = re.sub(re.escape(abbr), placeholder, temp_text, flags=re.IGNORECASE)
    
    # Split by sentence endings (.!? followed by whitespace)
    raw_sentences = re.split(r'(?<=[.!?])\s+', temp_text)
    
    sentences = []
    for s in raw_sentences:
        s = s.strip()
        if not s:
            continue
        # Restore abbreviations
        for abbr, placeholder in abbrs.items():
            s = re.sub(re.escape(placeholder), abbr, s, flags=re.IGNORECASE)
        sentences.append(s)
    return sentences


def clean_task_description(text: str) -> str:
    text = text.strip()
    
    # Strip speaker prefix (e.g. "Developer: ", "Priya: ", "Daniel:")
    speaker_match = re.match(r'^(?:\[\d{2}:\d{2}:\d{2}\]\s+)?([a-zA-Z]+):\s*', text)
    if speaker_match:
        text = text[speaker_match.end():].strip()
        
    # Strip common starting conversational fillers
    fillers = [
        r"^yes,\s*", r"^sure,\s*", r"^ok,\s*", r"^so,\s*", r"^agreed,\s*", r"^great,\s*", 
        r"^indeed,\s*", r"^right,\s*", r"^absolutely,\s*", r"^definitely,\s*"
    ]
    changed = True
    while changed:
        changed = False
        for fill in fillers:
            m = re.match(fill, text.lower())
            if m:
                text = text[m.end():].strip()
                changed = True
                break

    # Strip pronouns and modals (avoiding pronouns at the beginning of actions)
    prefixes = [
        r"^(?:i|we|he|she|they|you)\s+(?:will|shall|should|must|can|could|would|might|ll)\b",
        r"^(?:i|we|he|she|they|you)\s+(?:need|want)\s+to\b",
        r"^(?:i\'ll|we\'ll|they\'ll|you\'ll)\b",
        r"^(?:let\'s|lets)\b",
        r"^(?:i|we|he|she|they|you)\s+have\s+to\b",
        r"^(?:i|we|he|she|they|you)\s+want\s+us\s+to\b",
    ]
    
    s_lower = text.lower()
    for pat in prefixes:
        match = re.match(pat, s_lower)
        if match:
            text = text[match.end():].strip()
            break

    if text:
        text = text[0].upper() + text[1:]
    return text


class GroqIntelligenceClient:
    """
    Manages AI completions entirely offline using T5-Small summarization and rule-based NLP extraction.
    Does not make any external API calls, ensuring full offline availability and compatibility.
    """
    
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self._client = None
        self.model = "offline-nlp-t5-small"
        self._tokenizer = None
        self._t5_model = None

    def _get_t5(self):
        if self._tokenizer is None or self._t5_model is None:
            logger.info("Initializing offline T5-small model and tokenizer...")
            self._tokenizer = T5Tokenizer.from_pretrained("t5-small")
            self._t5_model = T5ForConditionalGeneration.from_pretrained("t5-small")
            logger.info("T5-small initialized successfully.")
        return self._tokenizer, self._t5_model

    def _run_t5_summary(self, text: str, max_length: int = 150) -> str:
        if not text or not text.strip():
            return ""
        try:
            tokenizer, model = self._get_t5()
            inputs = tokenizer.encode("summarize: " + text, return_tensors="pt", max_length=512, truncation=True)
            outputs = model.generate(
                inputs, 
                max_length=max_length, 
                num_beams=4, 
                length_penalty=2.0, 
                early_stopping=True
            )
            return tokenizer.decode(outputs[0], skip_special_tokens=True)
        except Exception as e:
            logger.error(f"Error running T5-small summarization: {e}")
            return text[:max_length]

    @property
    def client(self):
        """No external client needed, but return self for compatibility."""
        return self

    def generate_summary(self, transcript: str) -> Dict[str, any]:
        """
        Extracts summary components from a meeting transcript offline:
        - Key points (using T5 chunk-wise summarization)
        - Core decisions (using hybrid keyword-T5 extraction)
        - Highlighted risks (using hybrid keyword-T5 extraction)
        - Action items (using hybrid keyword-T5 task cleaning and metadata parser)
        """
        if not transcript or not transcript.strip():
            return {
                "key_points": "No discussion recorded.",
                "decisions": "No decisions captured.",
                "risks": "None identified.",
                "next_steps": "No actions scheduled.",
                "action_items": []
            }

        # Dynamic participant extraction from transcript turns
        speaker_pattern = re.compile(r'(?:\[\d{2}:\d{2}:\d{2}\]\s+)?([a-zA-Z]+):')
        participants = set()
        for line in transcript.split('\n'):
            match = speaker_pattern.match(line.strip())
            if match:
                participants.add(match.group(1))

        # Default fallback names if no speaker structure is found
        if not participants:
            participants = {"Moksh", "Developer", "User", "Team", "Admin"}

        # Extract sentences with speaker context
        lines = transcript.split('\n')
        current_speaker = "Unknown"
        context_sentences = [] # list of tuples: (sentence, speaker_name)
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            match = speaker_pattern.match(line)
            if match:
                current_speaker = match.group(1)
                line_content = line[match.end():].strip()
            else:
                line_content = line
            
            for s in split_into_sentences(line_content):
                if s.strip():
                    context_sentences.append((s, current_speaker))

        if not context_sentences:
            return {
                "key_points": "No discussion recorded.",
                "decisions": "No decisions captured.",
                "risks": "None identified.",
                "next_steps": "No actions scheduled.",
                "action_items": []
            }

        # 1. Key Points Generation: Chunk transcript and run T5 on each chunk
        chunks = []
        current_chunk = []
        current_word_count = 0
        
        for sentence, _ in context_sentences:
            words = sentence.split()
            if current_word_count + len(words) > 350:
                chunks.append(" ".join(current_chunk))
                current_chunk = [sentence]
                current_word_count = len(words)
            else:
                current_chunk.append(sentence)
                current_word_count += len(words)
                
        if current_chunk:
            chunks.append(" ".join(current_chunk))
            
        key_points_list = []
        for idx, chunk in enumerate(chunks[:5]): # limit to top 5 chunks
            chunk_summary = self._run_t5_summary(chunk, max_length=80)
            if chunk_summary and len(chunk_summary.strip()) > 5:
                key_points_list.append(clean_task_description(chunk_summary.strip()))
                
        key_points_formatted = "\n".join(f"- {pt}" for pt in key_points_list) if key_points_list else "- No discussion recorded."

        # Heuristic search configuration for other sections
        decision_keywords = ["agree", "agreed", "consensus", "decide", "decided", "approved", "settle", "settled", "approve", "conclude", "concluded", "we will", "resolved"]
        risk_keywords = ["risk", "worry", "concern", "bug", "issue", "blocker", "fail", "danger", "delay", "difficult", "warn", "warning", "threat", "broken", "critical"]
        next_steps_keywords = ["next steps", "milestone", "upcoming", "roadmap", "timeline", "schedule", "future", "later on", "next phase"]
        action_keywords = ["todo", "task", "action", "assign", "need to", "must", "responsible", "will handle", "action item", "to do", "assigned to"]

        decision_sentences = []
        risk_sentences = []
        next_steps_sentences = []
        action_sentences_context = [] # list of tuples: (sentence, speaker)

        for s, speaker in context_sentences:
            s_lower = s.lower()
            if any(kw in s_lower for kw in decision_keywords):
                decision_sentences.append(s)
            if any(kw in s_lower for kw in risk_keywords):
                risk_sentences.append(s)
            if any(kw in s_lower for kw in next_steps_keywords):
                next_steps_sentences.append(s)
            if any(kw in s_lower for kw in action_keywords) or ("will" in s_lower and any(name.lower() in s_lower for name in participants)):
                action_sentences_context.append((s, speaker))

        # 2. Decisions Generation
        if decision_sentences:
            merged_decisions = " ".join(decision_sentences)
            decisions_summary = self._run_t5_summary(merged_decisions, max_length=120)
            dec_pts = split_into_sentences(decisions_summary)
            dec_pts_cleaned = [clean_task_description(dec) for dec in dec_pts]
            decisions_formatted = "\n".join(f"{i+1}. {dec.strip()}" for i, dec in enumerate(dec_pts_cleaned[:4]) if len(dec.strip()) > 3)
            if not decisions_formatted.strip():
                decisions_formatted = "1. Standard meeting progression; no formal decisions recorded."
        else:
            decisions_formatted = "1. Standard meeting progression; no formal decisions recorded."

        # 3. Risks Generation
        if risk_sentences:
            merged_risks = " ".join(risk_sentences)
            risks_summary = self._run_t5_summary(merged_risks, max_length=100)
            risk_pts = split_into_sentences(risks_summary)
            risk_pts_cleaned = [clean_task_description(risk) for risk in risk_pts]
            risks_formatted = "\n".join(f"- {risk.strip()}" for risk in risk_pts_cleaned[:4] if len(risk.strip()) > 3)
            if not risks_formatted.strip():
                risks_formatted = "- No critical risks or blockers identified."
        else:
            risks_formatted = "- No critical risks or blockers identified."

        # 4. Next Steps Generation
        if next_steps_sentences:
            merged_ns = " ".join(next_steps_sentences)
            ns_summary = self._run_t5_summary(merged_ns, max_length=100)
            ns_pts = split_into_sentences(ns_summary)
            ns_pts_cleaned = [clean_task_description(ns) for ns in ns_pts]
            next_steps_formatted = "\n".join(f"- {ns.strip()}" for ns in ns_pts_cleaned[:3] if len(ns.strip()) > 3)
            if not next_steps_formatted.strip():
                next_steps_formatted = "- Proceed with standard project roadmap."
        else:
            next_steps_formatted = "- Proceed with standard project roadmap."

        # 5. Action Items Generation
        action_items_list = []
        for s, speaker in action_sentences_context[:8]: # Process up to 8 action items
            s_lower = s.lower()
            
            # Clean task text
            task_desc = self._run_t5_summary(s, max_length=45).strip()
            if not task_desc or len(task_desc) < 5:
                task_desc = s
            task_desc = clean_task_description(task_desc)

            # 1. Assignee detection (avoid pronouns and select actual name)
            assignee = "TBD"
            
            # A. Scan sentence to see if another participant name is mentioned
            words_orig = re.findall(r'\b[a-zA-Z]+\b', s)
            for w in words_orig:
                w_lower = w.lower()
                for p in participants:
                    if p.lower() == w_lower:
                        assignee = p
                        break
                if assignee != "TBD":
                    break

            # B. If no participant name mentioned, check for self-reference pronouns (I, we, my, me)
            # and attribute to the active speaker
            if assignee == "TBD":
                first_person_patterns = [r"\bi\b", r"\bwe\b", r"\bi'll\b", r"\bwe'll\b", r"\bmy\b", r"\bme\b"]
                if any(re.search(pat, s_lower) for pat in first_person_patterns):
                    if speaker and speaker != "Unknown":
                        assignee = speaker

            # 2. Due date / Event detection
            due_date = "TBD"
            date_match = re.search(r'\b\d{4}-\d{2}-\d{2}\b', s)
            if date_match:
                due_date = date_match.group(0)
            else:
                # Prepositional time phrase regex
                time_event_match = re.search(
                    r'\b(by|before|on|at|until|next|this)\s+([a-zA-Z0-9\-\:\s]{1,25})(?=\b(?:and|to|for|is|will|with|in|at)\b|\.|\,|$)', 
                    s, 
                    re.IGNORECASE
                )
                if time_event_match:
                    phrase = time_event_match.group(0).strip()
                    phrase = re.sub(r'\s+', ' ', phrase)
                    time_keywords = {"today", "tomorrow", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "week", "month", "morning", "afternoon", "evening", "pm", "am", "date"}
                    if any(kw in phrase.lower() for kw in time_keywords):
                        due_date = phrase
                
                if due_date == "TBD":
                    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "tomorrow", "next week", "end of week", "today", "tonight"]
                    for d in days:
                        if d in s_lower:
                            due_date = d.capitalize()
                            break
            
            action_items_list.append({
                "task": task_desc,
                "assignee": assignee,
                "due_date": due_date,
                "status": "pending"
            })

        if not action_items_list:
            action_items_list = [
                {"task": "Follow up on general discussion points", "assignee": "Moksh", "due_date": "TBD", "status": "pending"}
            ]

        return {
            "key_points": key_points_formatted,
            "decisions": decisions_formatted,
            "risks": risks_formatted,
            "next_steps": next_steps_formatted,
            "action_items": action_items_list
        }

    def answer_transcript_question(self, query: str, context_transcripts: List[Dict]) -> str:
        """
        Answers search queries offline by performing TF-IDF relevance scoring across context transcripts,
        and returns clean excerpts cited by meeting title and date.
        """
        if not context_transcripts:
            return "I couldn't find any historical transcripts relevant to your request."

        # Stopwords to filter from query terms
        stopwords = {
            "the", "is", "at", "which", "on", "and", "a", "an", "of", "to", "for", "in", "that", "it", 
            "you", "we", "they", "our", "your", "have", "has", "had", "do", "does", "did", "be", "been", 
            "was", "were", "this", "but", "by", "with", "as", "or", "from", "about", "are", "then",
            "would", "should", "could", "will", "can", "their", "them", "us", "i", "me", "my", "so", "there",
            "what", "where", "why", "how", "who", "when", "about", "any", "some", "questions", "question", "answer"
        }

        query_words = re.findall(r'\b[a-zA-Z]{3,}\b', query.lower())
        query_keywords = [w for w in query_words if w not in stopwords]

        if not query_keywords:
            query_keywords = [w for w in query_words]

        matched_sentences = []
        for item in context_transcripts:
            m_id = item.get("id")
            title = item.get("title", "Untitled Meeting")
            date = item.get("date", "Unknown Date")
            text = item.get("transcript", "")
            
            sentences = split_into_sentences(text)
            for s in sentences:
                s_lower = s.lower()
                overlap = 0
                for kw in query_keywords:
                    if kw in s_lower:
                        overlap += 1
                if overlap > 0:
                    words_in_s = len(re.findall(r'\b\w+\b', s_lower))
                    score = overlap / (words_in_s + 5)
                    matched_sentences.append({
                        "sentence": s,
                        "title": title,
                        "date": date,
                        "score": score
                    })

        matched_sentences = sorted(matched_sentences, key=lambda x: x["score"], reverse=True)

        if not matched_sentences:
            meeting_info = ", ".join(f"'{item.get('title')}' on {item.get('date')}" for item in context_transcripts)
            return (
                f"I found the following matching meetings: {meeting_info}.\n\n"
                f"However, there were no direct sentences matching the keywords: {', '.join(query_keywords)}.\n"
                "Please try refining your search or inspecting specific meeting transcript files directly."
            )

        grouped_matches = {}
        for match in matched_sentences[:6]:
            key = (match["title"], match["date"])
            if key not in grouped_matches:
                grouped_matches[key] = []
            if match["sentence"] not in grouped_matches[key]:
                grouped_matches[key].append(match["sentence"])

        response_lines = ["Based on the meeting history, here are the relevant details found offline:\n"]
        for (title, date), sentences_list in grouped_matches.items():
            response_lines.append(f"From meeting **\"{title}\"** ({date}):")
            for s in sentences_list:
                clean_s = s
                if ":" in clean_s:
                    parts = clean_s.split(":", 1)
                    if len(parts[0].strip().split()) <= 2:
                        clean_s = parts[1].strip()
                response_lines.append(f"  - {clean_s}")
            response_lines.append("")

        return "\n".join(response_lines).strip()

    def _generate_mock_summary(self, transcript: str) -> Dict[str, any]:
        """Keep mock generator for compatibility, redirecting to local logic."""
        return self.generate_summary(transcript)


# Global AI Orchestration client
ai_client = GroqIntelligenceClient()
