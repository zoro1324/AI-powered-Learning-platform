#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'server.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Check if superuser already exists
if User.objects.filter(email='admin@example.com').exists():
    print("✓ Superuser already exists")
else:
    # Create superuser
    admin = User.objects.create_superuser(
        email='admin@example.com',
        full_name='Administrator',
        password='AdminPassword123!'
    )
    print(f"✓ Superuser created: {admin.email}")
    print(f"  Name: {admin.full_name}")
    print(f"  Password: AdminPassword123!")

# Verify
print(f"\nTotal users in database: {User.objects.count()}")
print(f"Superusers: {User.objects.filter(is_superuser=True).count()}")
