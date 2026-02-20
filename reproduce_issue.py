
import sys
import os

# Add project root to path (d:\AI-powered-Learning-platform\server)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), 'server'))
sys.path.append(PROJECT_ROOT)

import django
from django.conf import settings

# Configure Django settings if not already configured
if not settings.configured:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "server.settings")
    django.setup()

from api.services.pre_assessment_service import Question


def test_question_options():
    with open('reproduce.log', 'w') as f:
        f.write("Testing Question options validation...\n")
        
        # Case 1: Extra comma handling (from error log)
        bad_options = ["Option A", ",", "Option B", ",", "Option C", "I don't know about this course"]
        try:
            q = Question(
                question_text="Test?",
                topic="Test Topic",
                options=bad_options,
                correct_answer_index=0,
                explanation="Exp",
                difficulty_hint="Easy"
            )
            f.write("Case 1 (Commas) PASSED\n")
            # f.write(f"Cleaned options: {q.options}\n")
            assert len(q.options) == 4
        except Exception as e:
            f.write(f"Case 1 FAILED: {e}\n")

        # Case 2: 5 real options (truncate)
        five_options = ["A", "B", "C", "D", "E"]
        try:
            q = Question(
                question_text="Test?",
                topic="Test Topic",
                options=five_options,
                correct_answer_index=0,
                explanation="Exp",
                difficulty_hint="Easy"
            )
            f.write("Case 2 (5 options) PASSED\n")
            # f.write(f"Cleaned options: {q.options}\n")
            assert len(q.options) == 4
            assert q.options[3] == "I don't know about this course"
        except Exception as e:
            f.write(f"Case 2 FAILED: {e}\n")

        # Case 3: Too few options
        few_options = ["A", "B"]
        try:
            q = Question(
                question_text="Test?",
                topic="Test Topic",
                options=few_options,
                correct_answer_index=0,
                explanation="Exp",
                difficulty_hint="Easy"
            )
            f.write("Case 3 (Few options) FAILED (Should have raised ValueError)\n")
        except ValueError as e:
            f.write(f"Case 3 (Few options) PASSED (Caught expected error: {e})\n")
        except Exception as e:
            f.write(f"Case 3 FAILED with unexpected error: {e}\n")


if __name__ == "__main__":
    test_question_options()
