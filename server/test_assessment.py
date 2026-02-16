#!/usr/bin/env python
"""Test script to verify assessment service functionality"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'server.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from api.services.assessment_service import get_assessment_service

def test_assessment():
    try:
        print("Testing Assessment Service...")
        print("-" * 50)
        
        # Create service
        service = get_assessment_service()
        print("✓ Service created successfully")
        
        # Test 1: Generate initial MCQ
        print("\nTest 1: Generating initial MCQ for 'Web Development'...")
        result = service.generate_initial_mcq('Web Development')
        questions = result.get('questions', [])
        print(f"✓ Generated {len(questions)} questions")
        
        if questions:
            print(f"\nSample question:")
            print(f"Q: {questions[0].get('question', 'N/A')}")
            print(f"Options: {questions[0].get('options', [])}")
        
        print("\n" + "=" * 50)
        print("All tests passed!")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == '__main__':
    success = test_assessment()
    sys.exit(0 if success else 1)
