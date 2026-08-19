import json
import logging
import re
from typing import Dict, List, Optional

import torch
from transformers import T5ForConditionalGeneration, T5Tokenizer
from groq import Groq

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
    # Ensure speaker name is a single word or short name (max 20 chars) to prevent matching sentence clauses containing colons
    speaker_match = re.match(r'^(?:\[\d{2}:\d{2}:\d{2}\]\s+)?([a-zA-Z0-9\s_]{1,20}):\s*', text)
    if speaker_match:
        text = text[speaker_match.end():].strip()
        
    # Strip leading addressee name (e.g. "Neha, " or "Priya, ")
    # Ensure it is a single word (no spaces) of max 15 chars, capitalized, to avoid matching full clauses ending with commas
    addressee_match = re.match(r'^[A-Z][a-zA-Z0-9_]{1,14}\s*,\s*', text)
    if addressee_match:
        name = addressee_match.group(0).strip().rstrip(",").strip()
        if name.lower() not in ["first", "last", "next", "then", "so", "actually", "finally", "however", "otherwise"]:
            text = text[addressee_match.end():].strip()

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

    # Recursively strip leading pronouns, modals, and auxiliary constructs
    changed = True
    while changed:
        changed = False
        s_lower = text.lower()
        
        # List of regex patterns to strip at the start
        strip_patterns = [
            r"^(?:i|we|he|she|they|you|it|who)\b",
            r"^(?:will|would|should|could|shall|can|must|might|may|ll)\b",
            r"^(?:also|just|really|then|probably|actually|basically|so|now|please|simply)\b",
            r"^(?:need|needs|want|wants|hope|hopes|think|thinks|thought|like|likes|have|has|had|go|going)\b",
            r"^(?:to|us|for|that|this)\b",
            r"^(?:let\'s|lets)\b",
            r"^(?:\'ll|\'d|\'re|\'ve|\'s)\b"
        ]
        for pat in strip_patterns:
            match = re.match(pat, s_lower)
            if match:
                text = text[match.end():].strip()
                changed = True
                break

    if text:
        text = text[0].upper() + text[1:]
    return text


def is_filler_sentence(sentence: str) -> bool:
    s_clean = re.sub(r'[^\w\s]', '', sentence.strip().lower())
    words = s_clean.split()
    if not words:
        return True
    if len(words) <= 2:
        return True
    
    # Common audio/greeting/filler checks
    filler_phrases = [
        "can you hear me",
        "i can hear you",
        "hear you loud and clear",
        "sound check",
        "testing testing",
        "good morning",
        "good afternoon",
        "good evening",
        "talk to you later",
        "see you later",
        "see you tomorrow",
        "loud and clear",
        "see you"
    ]
    for phrase in filler_phrases:
        if phrase in s_clean:
            return True
            
    fillers = {"hello", "hi", "hey", "bye", "goodbye", "thanks", "thank", "you", "ok", "okay", "yes", "no", "yeah", "yep", "alright", "perfect", "sure", "cool", "great", "welcome"}
    if all(w in fillers or w in {"i", "we", "the", "me", "us", "it", "to", "and", "a", "is", "am", "are", "was", "were", "be", "been"} for w in words):
        return True
        
    return False


def is_topic_introduction(sentence: str) -> bool:
    s_lower = sentence.strip().lower()
    starters = [
        "let's discuss", "lets discuss", "quickly discuss", "discuss the",
        "talk about", "welcome to", "thanks for joining", "thanks for coming",
        "can everyone hear", "can you hear"
    ]
    return any(start in s_lower for start in starters)


def deduplicate_list(items: List[str]) -> List[str]:
    seen = set()
    result = []
    for item in items:
        cleaned = item.strip().rstrip(".").strip()
        if cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            result.append(item)
    return result


class LocalIntelligenceClient:
    """
    Manages AI completions using local T5-Base summarization and rule-based NLP extraction,
    with an optional Groq Cloud API fallback integration if key is provided.
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
            with torch.inference_mode():
                outputs = model.generate(
                    inputs, 
                    max_length=max_length, 
                    num_beams=1
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
        if not transcript or not transcript.strip():
            return {
                "key_points": "No discussion recorded.",
                "decisions": "No decisions captured.",
                "risks": "None identified.",
                "next_steps": "No actions scheduled.",
                "action_items": []
            }

        word_count = len(transcript.split())
        is_short = word_count < 250

        # Check if Groq API is enabled and user explicitly wants to use it
        if settings.GROQ_API_KEY:
            logger.info("Generating high-quality summary via Groq Cloud API...")
            try:
                if self._client is None:
                    self._client = Groq(api_key=settings.GROQ_API_KEY)
                
                system_prompt = (
                    "You are an expert AI meeting assistant. You are given a meeting transcript.\n"
                    "Generate a structured JSON summary of the meeting. The output MUST be a valid JSON object matching the following structure:\n"
                    "{\n"
                    "  \"key_points\": \"- Bullet point 1\\n- Bullet point 2... (ensure these are distinct, crisp, and do not repeat)\",\n"
                    "  \"decisions\": \"1. Decision 1\\n2. Decision 2... (avoid repetition)\",\n"
                    "  \"risks\": \"- Risk/concern 1\\n- Risk/concern 2... (avoid repetition)\",\n"
                    "  \"next_steps\": \"- Next step 1\\n- Next step 2... (avoid repetition)\",\n"
                    "  \"action_items\": [\n"
                    "    {\n"
                    "      \"task\": \"Clean task description (avoiding conversational pronouns like 'I', 'we', etc. at the start)\",\n"
                    "      \"assignee\": \"Actual participant name (do NOT use 'TBD' or pronouns like 'I' or 'We'. Map to the person who spoke or committed to the task)\",\n"
                    "      \"due_date\": \"Specific timeframe (e.g. 'Today', 'Tomorrow', 'Next week'. Avoid 'TBD', use 'ASAP' if unknown)\",\n"
                    "      \"status\": \"pending\"\n"
                    "    }\n"
                    "  ]\n"
                    "}\n"
                    "Return ONLY the raw JSON object. Do not include markdown code block syntax."
                )

                if is_short:
                    system_prompt += (
                        "\nIMPORTANT: The meeting is very short (under 3 minutes) or has a brief transcript. "
                        "You MUST generate an accurate and specific summary based on the actual discussion points, even if they are brief or informal. "
                        "Do NOT return generic placeholders like 'No discussion recorded' or 'None identified' if there is any conversation. "
                        "Extract the specific updates, decisions, risks, or tasks mentioned, even if simple."
                    )

                for model_name in ["llama-3.3-70b-specdec", "llama-3.1-8b-instant", "llama3-8b-8192"]:
                    try:
                        completion = self._client.chat.completions.create(
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": f"Transcript:\n{transcript}"}
                            ],
                            model=model_name,
                            response_format={"type": "json_object"},
                            temperature=0.2
                        )
                        res_text = completion.choices[0].message.content
                        res_json = json.loads(res_text)
                        
                        # Validate structure has required keys
                        required_keys = ["key_points", "decisions", "risks", "next_steps", "action_items"]
                        if all(k in res_json for k in required_keys):
                            return res_json
                    except Exception as e:
                        logger.warning(f"Failed using model {model_name} for summary: {e}. Retrying fallback...")
                        continue
            except Exception as e:
                logger.error(f"Error calling Groq API for summary: {e}. Falling back to local summarizer.")

        # Fallback to local offline summarizer
        return self._generate_local_summary(transcript)

    def _generate_local_summary(self, transcript: str) -> Dict[str, any]:
        """
        Extracts summary components from a meeting transcript offline:
        - Key points (using T5 chunk-wise summarization or direct extraction if short)
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

        # Dynamic participant extraction from transcript turns (supporting names with digits, spaces, and underscores like "Speaker 1")
        speaker_pattern = re.compile(r'(?:\[\d{2}:\d{2}:\d{2}\]\s+)?([a-zA-Z0-9\s_]{1,25}):')
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

        total_words = sum(len(s.split()) for s, _ in context_sentences)
        is_short = total_words < 250 or len(context_sentences) < 15

        # 1. Key Points Generation
        key_points_list = []
        if is_short:
            # For short meetings, bypass T5 to avoid blanking out the summary
            for s, speaker in context_sentences:
                if not is_filler_sentence(s):
                    cleaned = clean_task_description(s)
                    if speaker and speaker != "Unknown":
                        if not cleaned.lower().startswith(speaker.lower()):
                            cleaned = f"{speaker}: {cleaned}"
                    key_points_list.append(cleaned)
            
            if not key_points_list:
                key_points_list = [clean_task_description(s) for s, _ in context_sentences if len(s.split()) > 3]
        else:
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
                
            for idx, chunk in enumerate(chunks[:5]): # limit to top 5 chunks
                chunk_words = len(chunk.split())
                if chunk_words < 50:
                    # Bypass T5 for very short chunks
                    chunk_sents = split_into_sentences(chunk)
                    for s in chunk_sents:
                        if not is_filler_sentence(s):
                            key_points_list.append(clean_task_description(s))
                else:
                    chunk_summary = self._run_t5_summary(chunk, max_length=80)
                    if chunk_summary and len(chunk_summary.strip()) > 5:
                        key_points_list.append(clean_task_description(chunk_summary.strip()))

        # Split key points list into individual cleaned sentences for cleaner bullets
        all_key_points = []
        for pt in key_points_list:
            for s in split_into_sentences(pt):
                cleaned_s = clean_task_description(s)
                if len(cleaned_s.split()) > 2 and cleaned_s.lower() not in ["none identified", "none"]:
                    all_key_points.append(cleaned_s)
                    
        all_key_points = deduplicate_list(all_key_points)
        key_points_formatted = "\n".join(f"- {pt}" for pt in all_key_points[:10]) if all_key_points else "- No discussion recorded."

        # Heuristic search configuration for other sections
        decision_keywords = ["agree", "agreed", "consensus", "decide", "decided", "approved", "settle", "settled", "approve", "conclude", "concluded", "we will", "resolved", "confirmed", "confirm", "finalized", "finalize"]
        risk_keywords = ["risk", "worry", "concern", "bug", "issue", "blocker", "fail", "danger", "delay", "difficult", "warn", "warning", "threat", "broken", "critical", "problem", "error", "failure", "problematic", "obstacle", "bottleneck", "locked", "locking", "lock", "slow", "crashed", "crash", "crashes", "leaking", "leak", "buggy", "failed"]
        next_steps_keywords = ["next steps", "milestone", "upcoming", "roadmap", "timeline", "schedule", "future", "later on", "next phase", "plan to", "after this", "subsequently", "proceed with", "action plan", "next up", "going forward"]
        action_keywords = ["todo", "task", "action", "assign", "need to", "must", "responsible", "will handle", "action item", "to do", "assigned to", "will take care of", "will look into", "work on", "create", "fix", "update", "implement", "test", "deploy"]

        decision_sentences = []
        risk_sentences = []
        next_steps_sentences = []
        action_sentences_context = [] # list of tuples: (sentence, speaker)

        for idx, (s, speaker) in enumerate(context_sentences):
            s_lower = s.lower()
            s_stripped = s.strip()
            
            # Skip filler or topic intro unless it contains strong agreement keywords
            if is_filler_sentence(s) or is_topic_introduction(s):
                if not any(kw in s_lower for kw in ["agree", "agreed", "consensus", "approved", "resolved"]):
                    continue
            
            # Exclude questions and very short sentences (under 3 words) from Decisions, Risks, Next Steps
            is_question = s_stripped.endswith("?")
            is_very_short = len(s_stripped.split()) < 3
            
            # 1. Decisions
            if not is_question and not is_very_short and any(kw in s_lower for kw in decision_keywords):
                if len(s.split()) <= 2 and idx > 0:
                    prev_s, prev_speaker = context_sentences[idx-1]
                    if not is_filler_sentence(prev_s) and not is_topic_introduction(prev_s):
                        decision_sentences.append(f"{prev_speaker} proposed and {speaker} agreed: {prev_s}")
                else:
                    decision_sentences.append(s)
            
            # 2. Risks
            if not is_question and not is_very_short and any(kw in s_lower for kw in risk_keywords):
                risk_sentences.append(s)
                
            # 3. Next steps
            if not is_question and not is_very_short and any(kw in s_lower for kw in next_steps_keywords):
                next_steps_sentences.append(s)
                
            # 4. Action Items
            is_action = False
            if any(kw in s_lower for kw in action_keywords):
                is_action = True
            elif "will" in s_lower or "going to" in s_lower or "gonna" in s_lower:
                if speaker and speaker != "Unknown":
                    is_action = True
                elif any(name.lower() in s_lower for name in participants):
                    is_action = True
            
            if is_action:
                action_sentences_context.append((s, speaker))

        # 2. Decisions Generation
        dec_pts_cleaned = []
        if decision_sentences:
            dec_pts_cleaned = [clean_task_description(s) for s in decision_sentences if not is_filler_sentence(s)]
            
            # Clean and deduplicate decisions
            dec_pts_cleaned = deduplicate_list([d for d in dec_pts_cleaned if len(d.strip()) > 3])
            decisions_formatted = "\n".join(f"{i+1}. {dec.strip()}" for i, dec in enumerate(dec_pts_cleaned[:5]))
            if not decisions_formatted.strip():
                decisions_formatted = "1. General agreement on discussion points; no formal decisions recorded."
        else:
            decisions_formatted = "1. General agreement on discussion points; no formal decisions recorded."

        # 3. Risks Generation
        risk_pts_cleaned = []
        if risk_sentences:
            risk_pts_cleaned = [clean_task_description(s) for s in risk_sentences if not is_filler_sentence(s)]
            
            # Clean and deduplicate risks
            risk_pts_cleaned = deduplicate_list([r for r in risk_pts_cleaned if len(r.strip()) > 3])
            risks_formatted = "\n".join(f"- {risk.strip()}" for risk in risk_pts_cleaned[:5])
            if not risks_formatted.strip():
                risks_formatted = "- No critical risks or blockers identified."
        else:
            risks_formatted = "- No critical risks or blockers identified."

        # 4. Next Steps Generation
        next_steps_formatted = ""
        ns_pts_cleaned = []
        if next_steps_sentences:
            ns_pts_cleaned = [clean_task_description(s) for s in next_steps_sentences if not is_filler_sentence(s)]
            ns_pts_cleaned = deduplicate_list([n for n in ns_pts_cleaned if len(n.strip()) > 3])
            next_steps_formatted = "\n".join(f"- {ns.strip()}" for ns in ns_pts_cleaned[:5])

        # Fallback for next steps in short meetings: extract from the end of the meeting
        if not next_steps_formatted.strip():
            end_sentences = [s for s, _ in context_sentences[-4:] if not is_filler_sentence(s) and not is_topic_introduction(s)]
            if end_sentences:
                ns_pts_cleaned = deduplicate_list([clean_task_description(s) for s in end_sentences if len(s.strip()) > 3])
                next_steps_formatted = "\n".join(f"- {ns.strip()}" for ns in ns_pts_cleaned[:3])
            
            if not next_steps_formatted.strip():
                next_steps_formatted = "- Proceed with standard project roadmap."

        # 5. Action Items Generation
        action_items_list = []
        seen_tasks = set()
        
        for s, speaker in action_sentences_context[:8]: # Process up to 8 action items
            s_lower = s.lower()
            
            # Clean task text - bypass T5 for single sentence task descriptions
            task_desc = clean_task_description(s)
            if not task_desc or len(task_desc) < 5:
                task_desc = s

            # Prevent duplicate tasks
            task_key = task_desc.strip().rstrip(".").lower()
            if task_key in seen_tasks:
                continue
            seen_tasks.add(task_key)

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
            # and attribute to the active speaker, avoiding placeholders
            if assignee == "TBD" or assignee.lower() in ["i", "we", "user", "me", "us", "they", "he", "she", "you", "team", "admin", "tbd"]:
                if speaker and speaker != "Unknown" and speaker.lower() not in ["i", "we", "user", "me", "us", "they", "he", "she", "you", "team", "admin", "tbd"]:
                    assignee = speaker
                else:
                    # Fallback to the first participant name or host name to avoid TBD/pronouns
                    assignee = list(participants)[0] if participants else "Mokshith"

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
            
            # Avoid TBD due dates
            if due_date == "TBD":
                due_date = "ASAP"
            
            action_items_list.append({
                "task": task_desc,
                "assignee": assignee,
                "due_date": due_date,
                "status": "pending"
            })

        if not action_items_list:
            default_assignee = list(participants)[0] if participants else "Mokshith"
            action_items_list = [
                {"task": "Follow up on general discussion points", "assignee": default_assignee, "due_date": "ASAP", "status": "pending"}
            ]

        return {
            "key_points": key_points_formatted,
            "decisions": decisions_formatted,
            "risks": risks_formatted,
            "next_steps": next_steps_formatted,
            "action_items": action_items_list
        }

    def answer_transcript_question(self, query: str, context_transcripts: List[Dict]) -> str:
        if not context_transcripts:
            return "I couldn't find any historical transcripts relevant to your request."

        if settings.GROQ_API_KEY:
            logger.info("Answering transcript query via Groq Cloud API...")
            try:
                if self._client is None:
                    self._client = Groq(api_key=settings.GROQ_API_KEY)
                
                # Format context meetings
                context_str = ""
                for idx, item in enumerate(context_transcripts):
                    context_str += f"Meeting #{idx+1}: {item.get('title')} ({item.get('date')})\n"
                    context_str += f"Transcript Context Excerpts:\n{item.get('transcript')}\n"
                    context_str += "---\n"
                
                system_prompt = (
                    "You are a helpful AI Meeting Assistant. You are asked a question about a user's meeting history.\n"
                    "You will be given context transcripts. Use them to answer the user's query as accurately and professionally as possible.\n"
                    "Cite the specific meeting titles and dates in your response. Keep the response concise, formatted in clean markdown."
                )

                for model_name in ["llama-3.3-70b-specdec", "llama-3.1-8b-instant", "llama3-8b-8192"]:
                    try:
                        completion = self._client.chat.completions.create(
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": f"Context Transcripts:\n{context_str}\n\nQuestion: {query}"}
                            ],
                            model=model_name,
                            temperature=0.3
                        )
                        return completion.choices[0].message.content
                    except Exception as e:
                        logger.warning(f"Failed using model {model_name} for query: {e}. Retrying fallback...")
                        continue
            except Exception as e:
                logger.error(f"Error calling Groq API for query: {e}. Falling back to local offline search.")

        # Fallback to local offline search
        return self._answer_local_transcript_question(query, context_transcripts)

    def _answer_local_transcript_question(self, query: str, context_transcripts: List[Dict]) -> str:
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
ai_client = LocalIntelligenceClient()
