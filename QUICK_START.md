# 🚀 Quick Start Guide - Testing the Integration

## Step 1: Start the Backend Server

```bash
cd server
python manage.py runserver
```

Expected output:
```
Django version 5.2.10, using settings 'server.settings'
Starting development server at http://127.0.0.1:8000/
```

✅ Backend running on: **http://localhost:8000**

---

## Step 2: Start the Frontend Dev Server

Open a **new terminal**:

```bash
cd frontend
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

✅ Frontend running on: **http://localhost:5173**

---

## Step 3: Test Authentication Flow

### A. Register New User

1. Open browser: `http://localhost:5173`
2. Click **"Create Account"**
3. Fill in the form:
   - First Name: `John`
   - Last Name: `Doe`
   - Email: `john@example.com`
   - Password: `testpass123` (min 8 chars)
   - Confirm Password: `testpass123`
4. Click **"Create Account"**

**Expected Result:**
- ✅ Registration successful
- ✅ Auto-login with JWT tokens
- ✅ Redirect to `/dashboard`
- ✅ See welcome message: "Welcome back, John!"
- ✅ Stats show 0 courses, 0 progress, etc. (no data yet)

### B. Check User in Sidebar

**Expected Result:**
- ✅ Sidebar shows your name: "John Doe"
- ✅ Sidebar shows your email: "john@example.com"
- ✅ Avatar placeholder visible

### C. Test Logout

1. Click **"Logout"** button in sidebar

**Expected Result:**
- ✅ Logged out successfully
- ✅ Redirected to `/login`
- ✅ Tokens cleared from localStorage

### D. Test Login

1. Enter email: `john@example.com`
2. Enter password: `testpass123`
3. Click **"Login"**

**Expected Result:**
- ✅ Login successful
- ✅ Redirect to `/dashboard`
- ✅ Dashboard shows your data again

---

## Step 4: Verify Backend API

### Check Admin Panel (Optional)

1. Create superuser (if not already done):
```bash
cd server
python manage.py createsuperuser
```

2. Go to: `http://localhost:8000/admin`
3. Login with superuser credentials
4. Check:
   - ✅ Users section shows your registered user
   - ✅ Learning Profile created automatically
   - ✅ Activity Logs show registration event

### Check API Endpoints Directly

Visit: `http://localhost:8000/api/`

You should see the **Django REST Framework Browsable API** with all available endpoints:
- `/api/auth/`
- `/api/courses/`
- `/api/enrollments/`
- `/api/quiz-attempts/`
- `/api/dashboard/`
- etc.

---

## Step 5: Check Browser Developer Tools

### Verify Tokens Stored

1. Open Developer Tools (F12)
2. Go to **Application** tab → **Local Storage** → `http://localhost:5173`
3. You should see:
   - ✅ `access_token`: JWT access token
   - ✅ `refresh_token`: JWT refresh token
   - ✅ `user`: JSON with user data

### Check Network Requests

1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Refresh dashboard page
4. Look for request to `/api/dashboard/`
5. Check **Request Headers**:
   - ✅ `Authorization: Bearer <access_token>`

---

## Step 6: Test API with curl (Optional)

### Register via API
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email":"jane@example.com",
    "password":"password123",
    "password2":"password123",
    "first_name":"Jane",
    "last_name":"Smith"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "id": 2,
    "email": "jane@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    ...
  },
  "access": "eyJ0eXAiOiJKV1...",
  "refresh": "eyJ0eXAiOiJKV1..."
}
```

### Login via API
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email":"jane@example.com",
    "password":"password123"
  }'
```

### Access Dashboard (Protected)
```bash
# Replace YOUR_TOKEN with the access token from login
curl -X GET http://localhost:8000/api/dashboard/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ Success Checklist

After completing the steps above, you should have verified:

- [ ] Backend server runs without errors
- [ ] Frontend dev server runs without errors
- [ ] Can register new user via UI
- [ ] Registration creates user + learning profile in database
- [ ] Automatic login after registration
- [ ] Dashboard loads and shows user's name
- [ ] Sidebar displays user profile
- [ ] Logout works and redirects to login
- [ ] Login works with correct credentials
- [ ] Error shown for wrong credentials
- [ ] JWT tokens stored in localStorage
- [ ] API requests include Authorization header
- [ ] Protected endpoints require authentication
- [ ] Token refresh works automatically (test by waiting 1 hour or manually expire token)

---

## 🐛 Troubleshooting

### Issue: "CORS error" in browser console

**Solution:** 
- Check backend is running on port 8000
- Verify `CORS_ALLOWED_ORIGINS` in `server/server/settings.py` includes `http://localhost:5173`

### Issue: "Network Error" on API calls

**Solution:**
- Ensure backend server is running
- Check `.env.local` has correct `VITE_API_URL=http://localhost:8000/api`
- Verify firewall not blocking ports

### Issue: "Field required" error on registration

**Solution:**
- All fields are required: email, first_name, last_name, password, password2
- Password must be min 8 characters
- Passwords must match

### Issue: Database errors

**Solution:**
```bash
cd server
python manage.py migrate
```

### Issue: Import errors in frontend

**Solution:**
```bash
cd frontend
npm install
```

---

## 📊 Test Data (Optional)

To test with sample data, you can create courses via Django admin:

1. Login to admin: `http://localhost:8000/admin`
2. Create a **Course**:
   - Title: "Introduction to Python"
   - Category: "Programming"
   - Difficulty: "Beginner"
3. Create **Modules** for the course
4. Create **Lessons** for each module
5. Create **Questions** for diagnostic/final quizzes

Then test the frontend with real course data!

---

## 🎯 What to Test Next

Once basic auth is working, integrate these pages:

1. **Course Entry** - Create enrollment
2. **Assessment** - Take diagnostic quiz
3. **Learning Path** - View AI-generated roadmap
4. **Modules** - Browse course content
5. **Progress** - Track completion

All the APIs are ready - just need to wire up the remaining pages!

---

## 📞 Need Help?

Check these files for reference:
- `INTEGRATION_COMPLETE.md` - Full integration details
- `frontend/src/app/pages/LoginPage.tsx` - Example of integrated auth page
- `frontend/src/app/pages/DashboardPage.tsx` - Example of integrated dashboard
- `frontend/src/store/slices/authSlice.ts` - Auth Redux logic
- `backend/api/views.py` - All API endpoint implementations

---

**Happy Testing! 🎉**
