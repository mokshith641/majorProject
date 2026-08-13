import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(backend_dir)

from app.ai.ai_client import ai_client

def run_tests():
    print("--------------------------------------------------")
    print("Testing Short Meeting (2-3 mins) Transcript")
    print("--------------------------------------------------")
    short_transcript = """
[00:00:05] Moksh: Hey, Daniel. Thanks for joining. Let's quickly discuss the database issue.
[00:00:15] Daniel: Yes, I noticed that SQLite is locked when multiple writes happen simultaneously.
[00:00:30] Moksh: Right, so we need to switch to PostgreSQL for local dev as well to match production.
[00:00:45] Daniel: Agreed. I will migrate the connection string today.
[00:01:00] Moksh: Great. Please make sure to update the environment file and push to GitHub. I'll test it on my end.
[00:01:15] Daniel: Sure, I can do that before tomorrow.
[00:01:30] Moksh: Perfect, thanks. Let's catch up tomorrow morning. Can you hear me okay?
[00:01:40] Daniel: Yes, loud and clear. See you tomorrow.
"""
    
    summary = ai_client._generate_local_summary(short_transcript)
    
    print("\n--- Generated Summary Output ---")
    print(f"Key Points:\n{summary['key_points']}\n")
    print(f"Decisions:\n{summary['decisions']}\n")
    print(f"Risks:\n{summary['risks']}\n")
    print(f"Next Steps:\n{summary['next_steps']}\n")
    print(f"Action Items:\n{summary['action_items']}\n")
    
    # Assertions to verify quality
    assert "No discussion recorded." not in summary["key_points"], "Should have key points!"
    assert "General agreement" in summary["decisions"] or len(summary["decisions"].strip()) > 5, "Should identify decisions/agreement!"
    assert "SQLite" in summary["key_points"] or "database" in summary["key_points"].lower(), "Should extract database detail"
    assert any("migrate" in item["task"].lower() or "database" in item["task"].lower() for item in summary["action_items"]), "Should extract the migration action item"
    
    print("Verification successful: Short meeting summary matches the expected details and does not return empty defaults!")

if __name__ == "__main__":
    run_tests()
