import unittest
import json
from unittest.mock import patch, MagicMock
from api.services.content_validator import validate_content, validate_with_retry, ValidationResult

class TestContentValidator(unittest.TestCase):

    @patch('api.services.content_validator.generate_text')
    def test_validation_approved(self, mock_generate):
        # Setup mock to return a valid approved response
        mock_generate.return_value = json.dumps({
            "approved": True,
            "feedback": "Content looks great!",
            "issues": []
        })

        result = validate_content(
            content="This is some good AI content about Python.",
            topic="Python programming",
            content_type="notes"
        )

        self.assertTrue(result.approved)
        self.assertEqual(result.feedback, "Content looks great!")
        self.assertEqual(len(result.issues), 0)
        mock_generate.assert_called_once()

    @patch('api.services.content_validator.generate_text')
    def test_validation_rejected(self, mock_generate):
        # Setup mock to return a rejected response
        mock_generate.return_value = json.dumps({
            "approved": False,
            "feedback": "Content is too short and lacks detail.",
            "issues": ["Incomplete", "Lacks depth"]
        })

        result = validate_content(
            content="Python is a language.",
            topic="Python programming",
            content_type="notes"
        )

        self.assertFalse(result.approved)
        self.assertIn("Incomplete", result.issues)
        self.assertEqual(result.feedback, "Content is too short and lacks detail.")

    @patch('api.services.content_validator.generate_text')
    def test_malformed_json_fallback(self, mock_generate):
        # Setup mock to return garbage
        mock_generate.return_value = "I am not JSON, I am just a casual chatter."

        result = validate_content(
            content="Some content",
            topic="Some topic",
            content_type="notes"
        )

        # Should be rejected because it couldn't be parsed
        self.assertFalse(result.approved)
        self.assertIn("Reviewer response was not valid JSON.", result.issues)

    @patch('api.services.content_validator.generate_text')
    def test_reviewer_exception_approves_with_warning(self, mock_generate):
        # Setup mock to raise an exception
        mock_generate.side_effect = Exception("API Key Expired")

        result = validate_content(
            content="Some content",
            topic="Some topic",
            content_type="notes"
        )

        # Per requirement: "On reviewer failure, approve with a warning so pipeline can continue"
        self.assertTrue(result.approved)
        self.assertIn("Reviewer call failed", result.feedback)

    @patch('api.services.content_validator.validate_content')
    def test_validate_with_retry_success_first_try(self, mock_validate):
        mock_validate.return_value = ValidationResult(approved=True, feedback="Good")
        
        gen_fn = MagicMock(return_value="Valid Content")
        
        content, result = validate_with_retry(
            generate_fn=gen_fn,
            topic="Topic",
            content_type="notes",
            max_retries=3
        )
        
        self.assertEqual(content, "Valid Content")
        self.assertTrue(result.approved)
        self.assertEqual(gen_fn.call_count, 1)

    @patch('api.services.content_validator.validate_content')
    def test_validate_with_retry_success_on_retry(self, mock_validate):
        # First call rejected, second approved
        mock_validate.side_effect = [
            ValidationResult(approved=False, feedback="Bad", issues=["Short"]),
            ValidationResult(approved=True, feedback="Good")
        ]
        
        gen_fn = MagicMock(side_effect=["Bad Content", "Good Content"])
        
        content, result = validate_with_retry(
            generate_fn=gen_fn,
            topic="Topic",
            content_type="notes",
            max_retries=3
        )
        
        self.assertEqual(content, "Good Content")
        self.assertTrue(result.approved)
        self.assertEqual(gen_fn.call_count, 2)

    @patch('api.services.content_validator.validate_content')
    def test_validate_with_retry_exhaustion(self, mock_validate):
        # All calls rejected
        mock_validate.return_value = ValidationResult(approved=False, feedback="Still Bad", issues=["Short"])
        
        gen_fn = MagicMock(return_value="Attempted Content")
        
        content, result = validate_with_retry(
            generate_fn=gen_fn,
            topic="Topic",
            content_type="notes",
            max_retries=3
        )
        
        self.assertEqual(content, "Attempted Content")
        self.assertFalse(result.approved)
        self.assertEqual(gen_fn.call_count, 3)

if __name__ == '__main__':
    unittest.main()
