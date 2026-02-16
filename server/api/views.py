from rest_framework import status, viewsets, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Q, Avg, Count, Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .models import (
    VideoTask, LearningProfile, Course, Module, Lesson, Resource,
    Enrollment, Question, QuizAttempt, QuizAnswer, ModuleProgress,
    LearningRoadmap, Achievement, UserAchievement, ActivityLog
)
from .serializers import (
    VideoTaskCreateSerializer, VideoTaskStatusSerializer,
    UserRegisterSerializer, UserSerializer, LearningProfileSerializer,
    CustomTokenObtainPairSerializer, CourseSerializer, ModuleSerializer,
    LessonSerializer, ResourceSerializer, EnrollmentSerializer,
    QuestionSerializer, QuizAttemptSerializer, QuizAnswerSerializer,
    QuizSubmissionSerializer, ModuleProgressSerializer,
    LearningRoadmapSerializer, AchievementSerializer,
    UserAchievementSerializer, ActivityLogSerializer
)
from .tasks import generate_video_task

User = get_user_model()


# ============================================================================
# AUTHENTICATION VIEWS
# ============================================================================

class RegisterView(APIView):
    """User registration endpoint"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            # Log activity
            ActivityLog.objects.create(
                user=user,
                activity_type='account_created',
                description=f'New account created'
            )
            
            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login view with user data"""
    permission_classes = [permissions.AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    """Logout endpoint - blacklist refresh token"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            
            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                activity_type='logout',
                description='User logged out'
            )
            
            return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    """Get and update current user profile"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            
            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                activity_type='profile_updated',
                description='Profile information updated'
            )
            
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LearningProfileView(APIView):
    """Get and update user learning profile"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        profile, created = LearningProfile.objects.get_or_create(user=request.user)
        serializer = LearningProfileSerializer(profile)
        return Response(serializer.data)
    
    def patch(self, request):
        profile, created = LearningProfile.objects.get_or_create(user=request.user)
        serializer = LearningProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            
            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                activity_type='preferences_updated',
                description='Learning preferences updated'
            )
            
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============================================================================
# COURSE & CONTENT VIEWSETS
# ============================================================================

class CourseViewSet(viewsets.ModelViewSet):
    """ViewSet for courses"""
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'category']
    ordering_fields = ['created_at', 'title']
    
    @action(detail=True, methods=['get'])
    def modules(self, request, pk=None):
        """Get all modules for a course"""
        course = self.get_object()
        modules = course.modules.all().order_by('order')
        serializer = ModuleSerializer(modules, many=True)
        return Response(serializer.data)


class ModuleViewSet(viewsets.ModelViewSet):
    """ViewSet for modules"""
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['course', 'difficulty_level']
    ordering_fields = ['order', 'title']
    
    @action(detail=True, methods=['get'])
    def lessons(self, request, pk=None):
        """Get all lessons for a module"""
        module = self.get_object()
        lessons = module.lessons.all().order_by('order')
        serializer = LessonSerializer(lessons, many=True)
        return Response(serializer.data)


class LessonViewSet(viewsets.ModelViewSet):
    """ViewSet for lessons"""
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['module']
    ordering_fields = ['order', 'title']
    
    @action(detail=True, methods=['get'])
    def resources(self, request, pk=None):
        """Get all resources for a lesson"""
        lesson = self.get_object()
        resources = lesson.resources.all()
        serializer = ResourceSerializer(resources, many=True, context={'request': request})
        return Response(serializer.data)


class ResourceViewSet(viewsets.ModelViewSet):
    """ViewSet for resources"""
    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lesson', 'resource_type']


class EnrollmentViewSet(viewsets.ModelViewSet):
    """ViewSet for enrollments"""
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['course', 'status']
    
    def get_queryset(self):
        """Filter enrollments by current user"""
        return Enrollment.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Create enrollment and log activity"""
        enrollment = serializer.save(user=self.request.user)
        
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            activity_type='course_enrolled',
            description=f'Enrolled in course: {enrollment.course.title}',
            related_course=enrollment.course
        )
    
    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """Get detailed progress for an enrollment"""
        enrollment = self.get_object()
        module_progress = enrollment.module_progress.all()
        
        return Response({
            'enrollment': EnrollmentSerializer(enrollment).data,
            'module_progress': ModuleProgressSerializer(module_progress, many=True).data,
            'overall_progress': enrollment.overall_progress,
            'status': enrollment.status
        })
    
    @action(detail=True, methods=['post'])
    def diagnostic_quiz(self, request, pk=None):
        """Generate diagnostic quiz for enrollment"""
        enrollment = self.get_object()
        
        # Get diagnostic questions for the course
        questions = Question.objects.filter(
            course=enrollment.course,
            question_type='diagnostic'
        )
        
        if not questions.exists():
            return Response(
                {'detail': 'No diagnostic questions available for this course.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create quiz attempt
        quiz_attempt = QuizAttempt.objects.create(
            user=request.user,
            enrollment=enrollment,
            quiz_type='diagnostic'
        )
        quiz_attempt.questions.set(questions)
        
        return Response({
            'attempt_id': quiz_attempt.id,
            'questions': QuestionSerializer(questions, many=True).data
        })


# ============================================================================
# QUIZ & ASSESSMENT VIEWSETS
# ============================================================================

class QuestionViewSet(viewsets.ModelViewSet):
    """ViewSet for questions"""
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['course', 'module', 'question_type', 'difficulty_level']


class QuizAttemptViewSet(viewsets.ModelViewSet):
    """ViewSet for quiz attempts"""
    queryset = QuizAttempt.objects.all()
    serializer_class = QuizAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter quiz attempts by current user"""
        return QuizAttempt.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def submit(self, request):
        """Submit quiz answers and calculate score"""
        serializer = QuizSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        attempt_id = serializer.validated_data['attempt_id']
        answers_data = serializer.validated_data['answers']
        
        try:
            quiz_attempt = QuizAttempt.objects.get(id=attempt_id, user=request.user)
        except QuizAttempt.DoesNotExist:
            return Response({'detail': 'Quiz attempt not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        if quiz_attempt.submitted_at:
            return Response({'detail': 'Quiz already submitted.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Process answers
        correct_count = 0
        for answer_data in answers_data:
            question = Question.objects.get(id=answer_data['question_id'])
            user_answer = answer_data['selected_option']
            is_correct = user_answer == question.correct_option
            
            QuizAnswer.objects.create(
                quiz_attempt=quiz_attempt,
                question=question,
                selected_option=user_answer,
                is_correct=is_correct
            )
            
            if is_correct:
                correct_count += 1
        
        # Calculate score
        total_questions = quiz_attempt.questions.count()
        score = (correct_count / total_questions * 100) if total_questions > 0 else 0
        
        quiz_attempt.score = score
        quiz_attempt.total_questions = total_questions
        quiz_attempt.submitted_at = timezone.now()
        quiz_attempt.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            activity_type='quiz_completed',
            description=f'Completed {quiz_attempt.quiz_type} quiz with score {score:.1f}%',
            related_course=quiz_attempt.enrollment.course if quiz_attempt.enrollment else None
        )
        
        return Response({
            'score': score,
            'correct_answers': correct_count,
            'total_questions': total_questions,
            'quiz_attempt': QuizAttemptSerializer(quiz_attempt).data
        })


class QuizAnswerViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for quiz answers (read-only)"""
    queryset = QuizAnswer.objects.all()
    serializer_class = QuizAnswerSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter answers by current user's quiz attempts"""
        return QuizAnswer.objects.filter(quiz_attempt__user=self.request.user)


# ============================================================================
# PROGRESS & ROADMAP VIEWSETS
# ============================================================================

class ModuleProgressViewSet(viewsets.ModelViewSet):
    """ViewSet for module progress"""
    queryset = ModuleProgress.objects.all()
    serializer_class = ModuleProgressSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['enrollment', 'module', 'status']
    
    def get_queryset(self):
        """Filter progress by current user's enrollments"""
        return ModuleProgress.objects.filter(enrollment__user=self.request.user)


class LearningRoadmapViewSet(viewsets.ModelViewSet):
    """ViewSet for learning roadmaps"""
    queryset = LearningRoadmap.objects.all()
    serializer_class = LearningRoadmapSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter roadmaps by current user's enrollments"""
        return LearningRoadmap.objects.filter(enrollment__user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate AI-powered learning roadmap"""
        enrollment_id = request.data.get('enrollment_id')
        
        try:
            enrollment = Enrollment.objects.get(id=enrollment_id, user=request.user)
        except Enrollment.DoesNotExist:
            return Response({'detail': 'Enrollment not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get user's learning profile
        learning_profile = getattr(request.user, 'learning_profile', None)
        
        # TODO: Integrate with Ollama to generate personalized roadmap
        # For now, create a basic roadmap with all modules
        roadmap, created = LearningRoadmap.objects.get_or_create(
            enrollment=enrollment,
            defaults={
                'personalization_factors': {
                    'learning_style': learning_profile.learning_style if learning_profile else 'visual',
                    'preferred_depth': learning_profile.preferred_depth if learning_profile else 'intermediate',
                    'learning_pace': learning_profile.learning_pace if learning_profile else 'moderate'
                },
                'ai_recommendations': 'Personalized learning path based on your profile and diagnostic quiz results.'
            }
        )
        
        # Add all modules to recommended modules
        course_modules = enrollment.course.modules.all()
        roadmap.recommended_modules.set(course_modules)
        
        # Create module progress entries
        for module in course_modules:
            ModuleProgress.objects.get_or_create(
                enrollment=enrollment,
                module=module
            )
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            activity_type='roadmap_generated',
            description=f'Learning roadmap generated for {enrollment.course.title}',
            related_course=enrollment.course
        )
        
        serializer = LearningRoadmapSerializer(roadmap)
        return Response(serializer.data)


class AchievementViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for achievements (read-only)"""
    queryset = Achievement.objects.all()
    serializer_class = AchievementSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category']


class UserAchievementViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for user achievements (read-only)"""
    queryset = UserAchievement.objects.all()
    serializer_class = UserAchievementSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter achievements by current user"""
        return UserAchievement.objects.filter(user=self.request.user)


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for activity logs (read-only)"""
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['activity_type']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']
    
    def get_queryset(self):
        """Filter activity logs by current user"""
        return ActivityLog.objects.filter(user=self.request.user)


# ============================================================================
# DASHBOARD VIEW
# ============================================================================

class DashboardView(APIView):
    """Get aggregated dashboard data"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Get enrollment statistics
        enrollments = Enrollment.objects.filter(user=user)
        active_enrollments = enrollments.filter(status='active')
        completed_enrollments = enrollments.filter(status='completed')
        
        # Calculate average progress
        avg_progress = enrollments.aggregate(Avg('overall_progress'))['overall_progress__avg'] or 0
        
        # Get recent activity
        recent_activities = ActivityLog.objects.filter(user=user).order_by('-timestamp')[:10]
        
        # Get earned achievements
        user_achievements = UserAchievement.objects.filter(user=user).count()
        
        return Response({
            'user': UserSerializer(user).data,
            'stats': {
                'total_courses': enrollments.count(),
                'active_courses': active_enrollments.count(),
                'completed_courses': completed_enrollments.count(),
                'average_progress': round(avg_progress, 1),
                'study_time_hours': round(user.total_study_time / 60, 1),
                'streak_days': user.streak_days,
                'achievements_earned': user_achievements
            },
            'recent_activities': ActivityLogSerializer(recent_activities, many=True).data,
            'active_enrollments': EnrollmentSerializer(active_enrollments, many=True).data[:5]
        })


# ============================================================================
# VIDEO GENERATION VIEWS (existing)
# ============================================================================


class GenerateVideoView(APIView):
    """POST: Create a video generation task and dispatch it to Celery."""

    def post(self, request):
        serializer = VideoTaskCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        video_task = VideoTask.objects.create(
            topic=serializer.validated_data["topic"],
            lesson_id=serializer.validated_data.get("lesson_id"),
        )

        generate_video_task.delay(str(video_task.id))

        return Response(
            VideoTaskStatusSerializer(video_task, context={"request": request}).data,
            status=status.HTTP_202_ACCEPTED,
        )


class VideoTaskStatusView(APIView):
    """GET: Check the status of a video generation task."""

    def get(self, request, task_id):
        try:
            video_task = VideoTask.objects.get(pk=task_id)
        except VideoTask.DoesNotExist:
            return Response(
                {"detail": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            VideoTaskStatusSerializer(video_task, context={"request": request}).data,
        )
