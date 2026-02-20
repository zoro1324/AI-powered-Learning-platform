
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
        print(f"Total Modules in JSON: {len(modules)}")
        
        for i, mod in enumerate(modules):
            print(f"Module index {i}: Name='{mod.get('module_name')}', Order='{mod.get('order')}'")

    except Enrollment.DoesNotExist:
        print(f"Enrollment {enrollment_id} not found")
    except PersonalizedSyllabus.DoesNotExist:
        print(f"Syllabus for Enrollment {enrollment_id} not found")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_syllabus(1)
