"""
Test script to verify the sub-topic learning platform changes
Run this with: python test_sub_topics.py
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_course_endpoints():
    """Test the new course endpoints"""
    
    print("\n" + "="*60)
    print("Testing Sub-Topic Learning Platform")
    print("="*60 + "\n")
    
    # Test 1: Get all courses (should include both broad topics and sub-topics)
    print("1. Testing GET /api/courses/")
    response = requests.get(f"{BASE_URL}/courses/")
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Found {len(data)} total items")
        broad_topics = [c for c in data if not c.get('is_sub_topic', True)]
        sub_topics = [c for c in data if c.get('is_sub_topic', True)]
        print(f"  - {len(broad_topics)} broad topics")
        print(f"  - {len(sub_topics)} learnable sub-topics")
    else:
        print(f"✗ Failed with status {response.status_code}")
    
    # Test 2: Get only learnable topics
    print("\n2. Testing GET /api/courses/learnable_topics/")
    response = requests.get(f"{BASE_URL}/courses/learnable_topics/")
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Found {len(data)} learnable sub-topics")
        if len(data) > 0:
            print(f"  Example: {data[0]['title']}")
    else:
        print(f"✗ Failed with status {response.status_code}")
    
    # Test 3: Check if a broad topic is learnable
    print("\n3. Testing GET /api/courses/1/check_learnable/ (AI & Machine Learning)")
    response = requests.get(f"{BASE_URL}/courses/1/check_learnable/")
    if response.status_code == 200:
        data = response.json()
        if not data.get('learnable'):
            print(f"✓ Correctly identified as NOT learnable")
            print(f"  Message: {data.get('message')}")
            print(f"  Suggested sub-topics: {data.get('total_sub_topics')} topics")
        else:
            print(f"✗ Incorrectly identified as learnable")
    else:
        print(f"✗ Failed with status {response.status_code}")
    
    # Test 4: Check if a sub-topic is learnable
    print("\n4. Testing GET /api/courses/6/check_learnable/ (Linear Regression)")
    response = requests.get(f"{BASE_URL}/courses/6/check_learnable/")
    if response.status_code == 200:
        data = response.json()
        if data.get('learnable'):
            print(f"✓ Correctly identified as learnable")
            print(f"  Message: {data.get('message')}")
            objectives = data.get('learning_objectives', [])
            if objectives:
                print(f"  Learning objectives: {len(objectives)} objectives")
                print(f"    - {objectives[0]}")
        else:
            print(f"✗ Incorrectly identified as NOT learnable")
    else:
        print(f"✗ Failed with status {response.status_code}")
    
    # Test 5: Get sub-topics for a broad topic
    print("\n5. Testing GET /api/courses/1/sub_topics/ (AI & ML sub-topics)")
    response = requests.get(f"{BASE_URL}/courses/1/sub_topics/")
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Found {data.get('total')} sub-topics for AI & Machine Learning")
        subtopics = data.get('sub_topics', [])
        if subtopics:
            print(f"  Example sub-topics:")
            for topic in subtopics[:3]:
                print(f"    - {topic['title']}")
    else:
        print(f"✗ Failed with status {response.status_code}")
    
    # Test 6: Filter courses by sub-topic status
    print("\n6. Testing GET /api/courses/?is_sub_topic=true")
    response = requests.get(f"{BASE_URL}/courses/?is_sub_topic=true")
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Found {len(data)} sub-topics using filter")
    else:
        print(f"✗ Failed with status {response.status_code}")
    
    print("\n" + "="*60)
    print("Testing Complete!")
    print("="*60 + "\n")

if __name__ == "__main__":
    test_course_endpoints()
