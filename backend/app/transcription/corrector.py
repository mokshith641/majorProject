import re
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


def levenshtein_distance(s1: str, s2: str) -> int:
    """
    Computes the Levenshtein distance between s1 and s2.
    Uses dynamic programming with O(min(M, N)) space.
    """
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
        
    return previous_row[-1]


def soundex_hash(word: str) -> str:
    """
    Encodes a word into its 4-character Soundex phonetic representation.
    """
    if not word or not word.isalpha():
        return ""
        
    word = word.upper()
    first_letter = word[0]
    
    # Soundex mappings
    mappings = {
        'B': '1', 'F': '1', 'P': '1', 'V': '1',
        'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
        'D': '3', 'T': '3',
        'L': '4',
        'M': '5', 'N': '5',
        'R': '6'
    }
    
    code = first_letter
    prev_digit = mappings.get(first_letter, '')
    
    for char in word[1:]:
        if char in mappings:
            digit = mappings[char]
            if digit != prev_digit:
                code += digit
                prev_digit = digit
        else:
            # Vowels, Y, H, W reset the duplication check in standard soundex, 
            # but we keep prev_digit empty if it is not mapped
            prev_digit = ''
            
    digits = [c for c in code[1:] if c.isdigit()]
    result = first_letter + "".join(digits)
    return result.ljust(4, '0')[:4]


class PhoneticCorrector:
    """
    Phonetically corrects misheard technical terms in transcribed text using a hybrid
    Soundex + Levenshtein distance matching pipeline.
    """
    
    def __init__(self, vocabulary: Dict[str, List[str]] = None):
        # Default technical dictionary mapping standard casing to common mishearings
        self.default_vocab = {
            "SQLite": ["sqlite", "sequel light", "sequel lite", "sequellight"],
            "FastAPI": ["fastapi", "fast api"],
            "Next.js": ["nextjs", "next js"],
            "React": ["react", "reactjs", "react js"],
            "Tailwind CSS": ["tailwindcss", "tailwind css", "tailwind"],
            "PostgreSQL": ["postgresql", "postgres", "postgres ql", "postgre sql"],
            "GitHub": ["github", "git hub"],
            "VS Code": ["vscode", "vs code"],
            "Whisper": ["whisper", "whisperer"],
            "PyAnnote": ["pyannote", "pie annot", "py annot"],
            "Docker": ["docker", "docer"],
            "Kubernetes": ["kubernetes", "k8s", "coobernetes"],
            "Gemini": ["gemini", "geminy", "gemini AI"],
            "TypeScript": ["typescript", "type script"],
            "JavaScript": ["javascript", "java script"],
            "Websocket": ["websocket", "web socket", "websockets"]
        }
        
        if vocabulary:
            self.default_vocab.update(vocabulary)
            
        self.target_terms = list(self.default_vocab.keys())
        
        # Pre-compile mappings for performance
        self.phrase_replacements: List[Tuple[re.Pattern, str]] = []
        self.single_word_exact_map: Dict[str, str] = {}
        self.soundex_dictionary: Dict[str, List[str]] = {} # Maps Soundex Code -> List of correct Target Terms
        
        self._initialize_mappings()

    def _initialize_mappings(self):
        for target, variants in self.default_vocab.items():
            for var in variants:
                var_clean = var.strip()
                if " " in var_clean:
                    # Multi-word phrase replacement regex pattern
                    pattern = re.compile(r'\b' + re.escape(var_clean) + r'\b', re.IGNORECASE)
                    self.phrase_replacements.append((pattern, target))
                else:
                    # Single-word exact map
                    self.single_word_exact_map[var_clean.lower()] = target
            
            # Soundex index for target terms and their variants
            target_soundex = soundex_hash(target)
            if target_soundex:
                self.soundex_dictionary.setdefault(target_soundex, []).append(target)
                
            for var in variants:
                if " " not in var:
                    var_soundex = soundex_hash(var)
                    if var_soundex:
                        self.soundex_dictionary.setdefault(var_soundex, []).append(target)
                        
        # Remove duplicates in soundex candidates lists
        for k in self.soundex_dictionary:
            self.soundex_dictionary[k] = list(set(self.soundex_dictionary[k]))

    def correct_text(self, text: str) -> str:
        """
        Processes the input text, correcting multi-word phrases and fuzzy single words.
        """
        if not text or not text.strip():
            return text
            
        # 1. Apply multi-word phrase corrections first
        corrected_text = text
        for pattern, replacement in self.phrase_replacements:
            corrected_text = pattern.sub(replacement, corrected_text)
            
        # 2. Tokenize into words, preserving spaces and punctuation to reconstruct the sentence
        # Split by non-word characters but keep them
        tokens = re.split(r'(\b[a-zA-Z]+\b)', corrected_text)
        
        new_tokens = []
        for token in tokens:
            # Check if this token is a word
            if token.isalpha():
                token_lower = token.lower()
                
                # Check A: Exact single-word match
                if token_lower in self.single_word_exact_map:
                    new_tokens.append(self.single_word_exact_map[token_lower])
                    continue
                
                # Check B: Phonetic matching via Soundex + Levenshtein fallback
                token_soundex = soundex_hash(token)
                candidates = self.soundex_dictionary.get(token_soundex, [])
                
                best_match = None
                best_distance = 999
                
                for candidate in candidates:
                    # Compare lowercase values
                    dist = levenshtein_distance(token_lower, candidate.lower())
                    if dist < best_distance:
                        best_distance = dist
                        best_match = candidate
                
                # Threshold check: replace if edit distance is within bounds
                # We use <= 2 for short words and normalized distance <= 0.35 for longer words
                threshold = max(2, int(len(token) * 0.35))
                if best_match and best_distance <= threshold:
                    new_tokens.append(best_match)
                else:
                    new_tokens.append(token)
            else:
                # Keep punctuation and spaces as is
                new_tokens.append(token)
                
        return "".join(new_tokens)


# Singleton instance of corrector
phonetic_corrector = PhoneticCorrector()
