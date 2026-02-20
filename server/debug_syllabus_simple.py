
import os
import django
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "server.settings")
django.setup()

from api.models import PersonalizedSyllabus, Enrollment

def check_syllabus(enrollment_id):
    try:
        enrollment = Enrollment.objects.get(pk=enrollment_id)
        syllabus = PersonalizedSyllabus.objects.get(enrollment=enrollment)
        
        data = syllabus.syllabus_data
        modules = data.get('modules', [])
        
        print(f"Enrollment ID: {enrollment_id}")
        print(f"Total Modules: {len(modules)}")
        
        for i, mod in enumerate(modules):
            print(f"[{i}] {mod.get('module_name')}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_syllabus(1)
