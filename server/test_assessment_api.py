#!/usr/bin/env python
"""Test script to verify assessment API endpoints"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'server.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.test import RequestFactory
from api.views import InitialAssessmentView
from django.contrib.auth import get_user_model
from api.models import Course

User = get_user_model()

def test_initial_assessment_endpoint():
    try:
        print("Testing Initial Assessment API Endpoint...")
        print("-" * 50)
        
        # Create test user
        user, created = User.objects.get_or_create(
            email='test@example.com',
            defaults={'full_name': 'Test User'}
        )
        if created:
            user.set_password('testpass123')
            user.save()
        print("✓ Test user ready")
        
        # Create test course
        course, created = Course.objects.get_or_create(
            title='Test Web Development Course',
            defaults={
                'name': 'Test Web Development Course',
                'description': 'Test course for assessment',
                'category': 'web_dev',
                'difficulty_level': 'beginner'
            }
        )
        print(f"✓ Test course ready (ID: {course.id})")
        
        # Create request
        factory = RequestFactory()
        request = factory.post('/api/assessment/initial/', {
            'course_id': course.id,
            'course_name': course.title
        }, content_type='application/json')
        request.user = user
        
        # Call view
        view = InitialAssessmentView.as_view()
        print("\nCalling API endpoint...")
        response = view(request)
        
        if response.status_code == 200:
            data = response.data
            questions = data.get('questions', [])
            print(f"✓ API returned {len(questions)} questions")
            print(f"\nFirst question: {questions[0].get('question', 'N/A')}")
            print("\n" + "=" * 50)
            print("API endpoint test passed!")
            return True
        else:
            print(f"✗ API returned status {response.status_code}")
            print(f"Response: {response.data}")
            return False
            
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_initial_assessment_endpoint()
    sys.exit(0 if success else 1)
