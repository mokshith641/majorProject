import sys
import os

# Add parent directory to sys.path to run this script easily
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from transcription.corrector import soundex_hash, levenshtein_distance, phonetic_corrector

def test_levenshtein():
    print("Testing Levenshtein distance...")
    print(f"sqlite vs sqlite: {levenshtein_distance('sqlite', 'sqlite')}")
    print(f"sqlite vs sequel: {levenshtein_distance('sqlite', 'sequel')}")
    print(f"postgres vs postgre: {levenshtein_distance('postgres', 'postgre')}")
    print(f"fastapi vs fast api: {levenshtein_distance('fastapi', 'fast api')}")
    
    assert levenshtein_distance("sqlite", "sqlite") == 0
    assert levenshtein_distance("sqlite", "sequel") == 5
    assert levenshtein_distance("postgres", "postgre") == 1
    assert levenshtein_distance("fastapi", "fast api") == 1
    print("Levenshtein tests passed!")

def test_soundex():
    print("Testing Soundex...")
    print(f"SQLite Soundex: {soundex_hash('SQLite')}")
    print(f"sqlite Soundex: {soundex_hash('sqlite')}")
    print(f"postgres Soundex: {soundex_hash('postgres')}")
    print(f"postgre Soundex: {soundex_hash('postgre')}")
    
    assert soundex_hash("SQLite") == soundex_hash("sqlite")
    assert soundex_hash("SQLite") == "S430"
    assert soundex_hash("postgres") == soundex_hash("postgre")
    print("Soundex tests passed!")

def test_corrector():
    print("Testing PhoneticCorrector...")
    
    # 1. Multi-word phrase test
    input_text = "I am developing a fast api application and using sequel light for database and next js on frontend."
    expected = "I am developing a FastAPI application and using SQLite for database and Next.js on frontend."
    output = phonetic_corrector.correct_text(input_text)
    print(f"Input:  {input_text}")
    print(f"Output: {output}")
    assert output == expected
    
    # 2. Single-word exact and phonetic correction test
    input_text_2 = "I configured postgres database and github repository, and we coded in typescript."
    expected_2 = "I configured PostgreSQL database and GitHub repository, and we coded in TypeScript."
    output_2 = phonetic_corrector.correct_text(input_text_2)
    print(f"Input:  {input_text_2}")
    print(f"Output: {output_2}")
    assert output_2 == expected_2
    
    # 3. Punctuation preservation test
    input_text_3 = "Is this react or react js? Or is it nextjs, next js, or docker?!"
    expected_3 = "Is this React or React? Or is it Next.js, Next.js, or Docker?!"
    output_3 = phonetic_corrector.correct_text(input_text_3)
    print(f"Input:  {input_text_3}")
    print(f"Output: {output_3}")
    assert output_3 == expected_3
    
    print("PhoneticCorrector tests passed!")

if __name__ == "__main__":
    try:
        test_levenshtein()
        test_soundex()
        test_corrector()
        print("\nAll corrector verification tests passed successfully!")
    except AssertionError as e:
        print(f"\nAssertion Error occurred: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        sys.exit(1)
