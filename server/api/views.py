from rest_framework import status, viewsets, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db.models import Q, Avg, Count, Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
import logging

logger = logging.getLogger(__name__)

from .models import (
    VideoTask, LearningProfile, Course, Module, Lesson, Resource,
    Enrollment, Question, QuizAttempt, QuizAnswer, ModuleProgress,
    LearningRoadmap, Achievement, UserAchievement, ActivityLog,
    PersonalizedSyllabus, CoursePlanningTask
)
from .serializers import (
    VideoTaskCreateSerializer, VideoTaskStatusSerializer,
    CoursePlanningTaskSerializer,
    UserRegisterSerializer, UserSerializer, LearningProfileSerializer,
    CustomTokenObtainPairSerializer, CourseSerializer, ModuleSerializer,
    LessonSerializer, ResourceSerializer, EnrollmentSerializer,
    QuestionSerializer, QuizAttemptSerializer, QuizAnswerSerializer,
    QuizSubmissionSerializer, ModuleProgressSerializer,
    LearningRoadmapSerializer, AchievementSerializer,
    UserAchievementSerializer, ActivityLogSerializer
)
from .tasks import generate_video_task
from .services.assessment_service import get_assessment_service
from .services.podcast_service import get_podcast_service

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
    search_fields = ['title', 'name', 'description', 'category']
    filterset_fields = ['category', 'difficulty_level', 'is_popular', 'is_sub_topic', 'created_by']
    ordering_fields = ['created_at', 'title', 'category']
    
    @action(detail=False, methods=['get'])
    def popular(self, request):
        """Get all popular courses"""
        popular_courses = self.queryset.filter(is_popular=True)
        serializer = self.get_serializer(popular_courses, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_created(self, request):
        """Get courses created by the current user"""
        created_courses = self.queryset.filter(created_by=request.user)
        serializer = self.get_serializer(created_courses, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def learnable_topics(self, request):
        """Get all learnable sub-topics (courses where is_sub_topic=True)"""
        sub_topics = self.queryset.filter(is_sub_topic=True)
        serializer = self.get_serializer(sub_topics, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def check_learnable(self, request, pk=None):
        """
        Check if a topic is learnable or if it's a broad topic.
        If it's a broad topic, return suggested sub-topics to learn instead.
        """
        course = self.get_object()
        
        if not course.is_sub_topic:
            # This is a broad topic - can't learn it directly
            # Get all sub-topics for this broad topic
            sub_topics = Course.objects.filter(
                is_sub_topic=True,
                parent_topic_name=course.title
            )
            
            return Response({
                'learnable': False,
                'message': f"We can't teach you the entire '{course.title}' topic, but we offer individual sub-topics you can learn one at a time.",
                'course': self.get_serializer(course).data,
                'suggested_sub_topics': self.get_serializer(sub_topics, many=True).data,
                'total_sub_topics': sub_topics.count()
            })
        else:
            # This is a learnable sub-topic
            return Response({
                'learnable': True,
                'message': f"You can learn '{course.title}' as an individual topic.",
                'course': self.get_serializer(course).data,
                'prerequisites': course.prerequisites,
                'learning_objectives': course.learning_objectives
            })
    
    @action(detail=True, methods=['get'])
    def sub_topics(self, request, pk=None):
        """Get all sub-topics for a broad topic"""
        course = self.get_object()
        
        if course.is_sub_topic:
            return Response({
                'message': f"'{course.title}' is already a sub-topic, not a broad topic."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        sub_topics = Course.objects.filter(
            is_sub_topic=True,
            parent_topic_name=course.title
        )
        
        return Response({
            'broad_topic': self.get_serializer(course).data,
            'sub_topics': self.get_serializer(sub_topics, many=True).data,
            'total': sub_topics.count()
        })
    
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
            activity_type='course_started',
            title=f'Enrolled in {enrollment.course.title}',
            description=f'Enrolled in course: {enrollment.course.title}',
            metadata={'course_id': enrollment.course.id}
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
            title=f'Completed {quiz_attempt.quiz_type} quiz',
            description=f'Completed {quiz_attempt.quiz_type} quiz with score {score:.1f}%',
            metadata={
                'course_id': quiz_attempt.enrollment.course.id if quiz_attempt.enrollment else None,
                'score': score
            }
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
            activity_type='course_started',
            title=f'Roadmap generated for {enrollment.course.title}',
            description=f'Learning roadmap generated for {enrollment.course.title}',
            metadata={'course_id': enrollment.course.id}
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
        recent_activities = ActivityLog.objects.filter(user=user).order_by('-created_at')[:10]
        
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

        # Check if Celery is enabled in settings
        use_celery = getattr(settings, 'USE_CELERY', True)
        
        if use_celery:
            # Try async with Celery
            try:
                generate_video_task.delay(str(video_task.id))
                logger.info(f"✅ Video task queued asynchronously: {video_task.id}")
            except Exception as e:
                logger.warning(f"⚠️ Celery failed ({e}), falling back to synchronous execution")
                use_celery = False
        
        if not use_celery:
            # Run synchronously (works without Redis)
            logger.info(f"ℹ️ Running video generation synchronously")
            try:
                from api.tasks import generate_video_task as task_func
                from api.models import VideoTask as VT, Resource
                from api.services.video_generator import VideoGeneratorService
                from django.core.files import File
                from django.utils import timezone
                
                # Execute the task logic directly without Celery
                try:
                    vt = VT.objects.get(pk=str(video_task.id))
                except VT.DoesNotExist:
                    logger.error(f"VideoTask {video_task.id} not found")
                    return Response(
                        {"error": "Video task not found"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
                
                # Run in a separate thread to avoid blocking
                import threading
                def run_sync():
                    try:
                        lesson_content = None
                        if vt.lesson and vt.lesson.content:
                            lesson_content = vt.lesson.content
                        
                        service = VideoGeneratorService(str(video_task.id))
                        final_path = service.run(vt.topic, content=lesson_content)
                        
                        with open(final_path, "rb") as f:
                            vt.video_file.save(f"video_{video_task.id}.mp4", File(f), save=False)
                        
                        try:
                            from moviepy import VideoFileClip
                            clip = VideoFileClip(final_path)
                            vt.duration_seconds = int(clip.duration)
                            clip.close()
                        except Exception:
                            pass
                        
                        vt.status = "completed"
                        vt.progress_message = "Video generation complete."
                        vt.completed_at = timezone.now()
                        vt.save()
                        
                        if vt.lesson:
                            try:
                                # Count existing video resources to create unique title
                                existing_count = Resource.objects.filter(
                                    lesson=vt.lesson,
                                    resource_type='video',
                                ).count()
                                
                                # Always create a new resource (allow multiple videos per topic)
                                Resource.objects.create(
                                    lesson=vt.lesson,
                                    title=f"Video: {vt.topic} #{existing_count + 1}",
                                    resource_type='video',
                                    file=vt.video_file,
                                    duration_seconds=vt.duration_seconds,
                                )
                                logger.info(f"✅ Created video resource #{existing_count + 1} for: {vt.topic}")
                            except Exception as e:
                                logger.error(f"Failed to create resource: {e}")
                        
                        logger.info(f"VideoTask {video_task.id} completed successfully")
                    except Exception as e:
                        logger.error(f"VideoTask {video_task.id} failed: {e}")
                        vt.status = "failed"
                        vt.progress_message = f"Error: {str(e)}"
                        vt.save()
                
                thread = threading.Thread(target=run_sync, daemon=True)
                thread.start()
                logger.info(f"✅ Video task started in background thread")
                
            except Exception as sync_error:
                logger.error(f"❌ Video generation failed to start: {sync_error}")
                video_task.status = "failed"
                video_task.progress_message = f"Failed to start: {str(sync_error)}"
                video_task.save()

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


# ============================================================================
# COURSE PLANNING VIEWS
# ============================================================================


class CoursePlanningView(APIView):
    """POST: Create a course planning task and run it in background thread."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CoursePlanningTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        planning_task = CoursePlanningTask.objects.create(
            course_title=serializer.validated_data["course_title"],
            course_description=serializer.validated_data["course_description"],
            category=serializer.validated_data.get("category", "other"),
            difficulty_level=serializer.validated_data.get("difficulty_level", "beginner"),
            estimated_duration=serializer.validated_data.get("estimated_duration", 60),
            thumbnail=serializer.validated_data.get("thumbnail", ""),
        )

        # Run course planning in a background thread
        import threading
        from api.models import CoursePlanningTask as CPT, Course
        from api.services.course_planning_service import CoursePlanningService
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Capture user_id for the background thread
        user_id = request.user.id
        
        def run_course_planning():
            try:
                cpt = CPT.objects.get(pk=str(planning_task.id))
                cpt.status = "processing"
                cpt.progress_message = "Analyzing topic and generating course plan..."
                cpt.save()
                
                logger.info(f"Starting course planning for: {cpt.course_title}")
                
                # Initialize the course planning service
                service = CoursePlanningService()
                
                # Generate the course plan using LLM
                course_plan = service.create_course_plan(
                    course_title=cpt.course_title,
                    course_description=cpt.course_description
                )
                
                # Convert to dict for storage
                plan_dict = service.plan_to_dict(course_plan)
                cpt.result_data = plan_dict
                cpt.progress_message = f"Course plan generated: {'Broad' if course_plan.is_broad else 'Narrow'} topic, {course_plan.total_courses} course(s)"
                cpt.save()
                
                logger.info(f"Course plan generated: is_broad={course_plan.is_broad}, total_courses={course_plan.total_courses}")
                
                # Create Course records based on the plan
                created_course_ids = []
                
                # Get the user who created this course
                creator = User.objects.get(id=user_id)
                
                if course_plan.is_broad:
                    # Broad topic: Create parent + children
                    cpt.progress_message = "Creating parent course and sub-courses..."
                    cpt.save()
                    
                    # Create parent course
                    parent_course = Course.objects.create(
                        title=cpt.course_title,
                        name=cpt.course_title,
                        description=cpt.course_description,
                        category=cpt.category,
                        difficulty_level=cpt.difficulty_level,
                        estimated_duration=cpt.estimated_duration,
                        thumbnail=cpt.thumbnail,
                        is_sub_topic=False,
                        parent_topic_name='',
                        is_popular=True,
                        created_by=creator,
                        learning_objectives=[],
                        prerequisites=[],
                    )
                    created_course_ids.append(str(parent_course.id))
                    logger.info(f"Created parent course: {parent_course.title} (ID: {parent_course.id})")
                    
                    # Create child courses for each course in the plan
                    difficulty_map = {
                        'Beginner': 'beginner',
                        'Intermediate': 'intermediate',
                        'Advanced': 'advanced',
                    }
                    
                    for idx, course_model in enumerate(course_plan.courses, 1):
                        child_course = Course.objects.create(
                            title=course_model.course_name,
                            name=course_model.course_name,
                            description=course_model.description,
                            category=cpt.category,
                            difficulty_level=difficulty_map.get(course_model.difficulty, 'beginner'),
                            estimated_duration=cpt.estimated_duration,
                            thumbnail=cpt.thumbnail,
                            is_sub_topic=True,
                            parent_topic_name=cpt.course_title,
                            is_popular=True,
                            created_by=creator,
                            learning_objectives=[],
                            prerequisites=course_model.prerequisites,
                        )
                        created_course_ids.append(str(child_course.id))
                        logger.info(f"Created child course {idx}/{course_plan.total_courses}: {child_course.title} (ID: {child_course.id})")
                
                else:
                    # Narrow topic: Create single course
                    cpt.progress_message = "Creating single comprehensive course..."
                    cpt.save()
                    
                    course_model = course_plan.courses[0]
                    difficulty_map = {
                        'Beginner': 'beginner',
                        'Intermediate': 'intermediate',
                        'Advanced': 'advanced',
                    }
                    
                    single_course = Course.objects.create(
                        title=course_model.course_name,
                        name=course_model.course_name,
                        description=course_model.description,
                        category=cpt.category,
                        difficulty_level=difficulty_map.get(course_model.difficulty, cpt.difficulty_level),
                        estimated_duration=cpt.estimated_duration,
                        thumbnail=cpt.thumbnail,
                        is_sub_topic=False,
                        parent_topic_name='',
                        is_popular=True,
                        created_by=creator,
                        learning_objectives=[],
                        prerequisites=[],
                    )
                    created_course_ids.append(str(single_course.id))
                    logger.info(f"Created single course: {single_course.title} (ID: {single_course.id})")
                
                # Mark task as completed
                cpt.status = "completed"
                cpt.created_courses = created_course_ids
                cpt.progress_message = f"Successfully created {len(created_course_ids)} course(s)"
                cpt.completed_at = timezone.now()
                cpt.save()
                
                logger.info(f"CoursePlanningTask {planning_task.id} completed successfully. Created {len(created_course_ids)} course(s).")
                
            except Exception as e:
                logger.exception(f"CoursePlanningTask {planning_task.id} failed")
                CPT.objects.filter(pk=str(planning_task.id)).update(
                    status="failed",
                    error_message=str(e),
                    progress_message="Course planning failed.",
                )
        
        # Start the background thread
        thread = threading.Thread(target=run_course_planning, daemon=True)
        thread.start()
        logger.info(f"✅ Course planning task {planning_task.id} started in background thread")

        return Response(
            CoursePlanningTaskSerializer(planning_task).data,
            status=status.HTTP_202_ACCEPTED,
        )


class CoursePlanningStatusView(APIView):
    """GET: Check the status of a course planning task."""
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        try:
            planning_task = CoursePlanningTask.objects.get(pk=task_id)
        except CoursePlanningTask.DoesNotExist:
            return Response(
                {"detail": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            CoursePlanningTaskSerializer(planning_task).data,
        )


# ============================================================================
# ASSESSMENT & PERSONALIZED LEARNING VIEWS
# ============================================================================

    def post(self, request):
        serializer = CoursePlanningTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        planning_task = CoursePlanningTask.objects.create(
            course_title=serializer.validated_data["course_title"],
            course_description=serializer.validated_data["course_description"],
            category=serializer.validated_data.get("category", "other"),
            difficulty_level=serializer.validated_data.get("difficulty_level", "beginner"),
            estimated_duration=serializer.validated_data.get("estimated_duration", 60),
            thumbnail=serializer.validated_data.get("thumbnail", ""),
        )

        # Check if Celery is enabled in settings
        use_celery = getattr(settings, 'USE_CELERY', True)
        
        if use_celery:
            # Try async with Celery
            try:
                from api.tasks import generate_course_plan_task
                generate_course_plan_task.delay(str(planning_task.id))
                logger.info(f"✅ Course planning task queued asynchronously: {planning_task.id}")
            except Exception as e:
                logger.warning(f"⚠️ Celery failed ({e}), falling back to synchronous execution")
                use_celery = False
        
        if not use_celery:
            # Run synchronously (works without Celery/Redis)
            logger.info(f"ℹ️ Running course planning synchronously")
            try:
                from api.tasks import generate_course_plan_task as task_func
                
                # Run in a separate thread to avoid blocking
                import threading
                def run_sync():
                    try:
                        # Execute the task logic directly
                        from api.models import CoursePlanningTask as CPT, Course
                        from api.services.course_planning_service import CoursePlanningService
                        from django.utils import timezone
                        
                        try:
                            cpt = CPT.objects.get(pk=str(planning_task.id))
                        except CPT.DoesNotExist:
                            logger.error(f"CoursePlanningTask {planning_task.id} not found")
                            return
                        
                        cpt.status = "processing"
                        cpt.progress_message = "Analyzing topic and generating course plan..."
                        cpt.save()
                        
                        service = CoursePlanningService()
                        course_plan = service.create_course_plan(
                            course_title=cpt.course_title,
                            course_description=cpt.course_description
                        )
                        
                        plan_dict = service.plan_to_dict(course_plan)
                        cpt.result_data = plan_dict
                        cpt.progress_message = f"Course plan generated: {'Broad' if course_plan.is_broad else 'Narrow'} topic, {course_plan.total_courses} course(s)"
                        cpt.save()
                        
                        created_course_ids = []
                        
                        if course_plan.is_broad:
                            # Create parent + children
                            parent_course = Course.objects.create(
                                title=cpt.course_title,
                                name=cpt.course_title,
                                description=cpt.course_description,
                                category=cpt.category,
                                difficulty_level=cpt.difficulty_level,
                                estimated_duration=cpt.estimated_duration,
                                thumbnail=cpt.thumbnail,
                                is_sub_topic=False,
                                parent_topic_name=None,
                                learning_objectives=[],
                                prerequisites=[],
                            )
                            created_course_ids.append(str(parent_course.id))
                            
                            for course_model in course_plan.courses:
                                difficulty_map = {
                                    'Beginner': 'beginner',
                                    'Intermediate': 'intermediate',
                                    'Advanced': 'advanced',
                                }
                                
                                child_course = Course.objects.create(
                                    title=course_model.course_name,
                                    name=course_model.course_name,
                                    description=course_model.description,
                                    category=cpt.category,
                                    difficulty_level=difficulty_map.get(course_model.difficulty, 'beginner'),
                                    estimated_duration=cpt.estimated_duration,
                                    thumbnail=cpt.thumbnail,
                                    is_sub_topic=True,
                                    parent_topic_name=cpt.course_title,
                                    learning_objectives=[],
                                    prerequisites=course_model.prerequisites,
                                )
                                created_course_ids.append(str(child_course.id))
                        else:
                            # Create single course
                            course_model = course_plan.courses[0]
                            difficulty_map = {
                                'Beginner': 'beginner',
                                'Intermediate': 'intermediate',
                                'Advanced': 'advanced',
                            }
                            
                            single_course = Course.objects.create(
                                title=course_model.course_name,
                                name=course_model.course_name,
                                description=course_model.description,
                                category=cpt.category,
                                difficulty_level=difficulty_map.get(course_model.difficulty, cpt.difficulty_level),
                                estimated_duration=cpt.estimated_duration,
                                thumbnail=cpt.thumbnail,
                                is_sub_topic=False,
                                parent_topic_name=None,
                                learning_objectives=[],
                                prerequisites=[],
                            )
                            created_course_ids.append(str(single_course.id))
                        
                        cpt.status = "completed"
                        cpt.created_courses = created_course_ids
                        cpt.progress_message = f"Successfully created {len(created_course_ids)} course(s)"
                        cpt.completed_at = timezone.now()
                        cpt.save()
                        
                        logger.info(f"CoursePlanningTask {planning_task.id} completed successfully")
                    except Exception as e:
                        logger.error(f"CoursePlanningTask {planning_task.id} failed: {e}")
                        cpt.status = "failed"
                        cpt.error_message = str(e)
                        cpt.progress_message = "Course planning failed."
                        cpt.save()
                
                thread = threading.Thread(target=run_sync, daemon=True)
                thread.start()
                logger.info(f"✅ Course planning task started in background thread")
                
            except Exception as sync_error:
                logger.error(f"❌ Course planning failed to start: {sync_error}")
                planning_task.status = "failed"
                planning_task.error_message = str(sync_error)
                planning_task.progress_message = f"Failed to start: {str(sync_error)}"
                planning_task.save()

        return Response(
            CoursePlanningTaskSerializer(planning_task, context={"request": request}).data,
            status=status.HTTP_202_ACCEPTED,
        )


class CoursePlanningStatusView(APIView):
    """GET: Check the status of a course planning task."""
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        try:
            planning_task = CoursePlanningTask.objects.get(pk=task_id)
        except CoursePlanningTask.DoesNotExist:
            return Response(
                {"detail": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            CoursePlanningTaskSerializer(planning_task, context={"request": request}).data,
        )


# ============================================================================
# ASSESSMENT & PERSONALIZED LEARNING VIEWS
# ============================================================================

class InitialAssessmentView(APIView):
    """Generate initial diagnostic MCQ questions for course enrollment using pre-knowledge assessment"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Generate initial assessment questions for a sub-topic.
        LLM determines the number of questions based on course complexity.
        
        Expected payload:
        {
            "course_id": 1,
            "course_name": "Linear Regression"
        }
        
        Returns:
        {
            "question_count": 8,
            "question_count_reasoning": "...",
            "questions": [
                {
                    "question_text": "...",
                    "topic": "...",
                    "options": [option1, option2, option3, "I don't know about this course"],
                    "correct_answer_index": 0-2,
                    "explanation": "...",
                    "difficulty_hint": "Beginner"
                }
            ]
        }
        """
        logger.info("="*60)
        logger.info("InitialAssessmentView.post() ENTERED")
        logger.info(f"Request user: {request.user}")
        logger.info(f"Request data: {request.data}")
        logger.info("="*60)
        
        from .services.pre_assessment_service import PreKnowledgeAssessment
        
        course_id = request.data.get('course_id')
        course_name = request.data.get('course_name')
        
        if not course_id or not course_name:
            return Response(
                {'error': 'course_id and course_name are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Verify course exists
            course = Course.objects.get(pk=course_id)
            
            # Check if this is a learnable sub-topic
            if not course.is_sub_topic:
                # Get sub-topics for this broad topic
                sub_topics = Course.objects.filter(
                    is_sub_topic=True,
                    parent_topic_name=course.title
                )
                return Response({
                    'error': f"Cannot enroll in '{course.title}' directly.",
                    'message': f"We can't teach you the entire '{course.title}' topic. Please choose from the individual sub-topics below.",
                    'learnable': False,
                    'suggested_sub_topics': CourseSerializer(sub_topics, many=True).data
                }, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info("="*60)
            logger.info("InitialAssessmentView: Calling PreKnowledgeAssessment service")
            logger.info(f"Course ID: {course_id}, Course Name: {course_name}")
            logger.info("="*60)
            
            # Initialize pre-knowledge assessment service
            assessment_service = PreKnowledgeAssessment()
            
            # Step 1: Let LLM determine optimal question count based on complexity
            question_decision = assessment_service.determine_question_count(
                course_name=course.name,
                course_description=course.description,
                difficulty=course.difficulty_level
            )
            
            question_count = question_decision['question_count']
            logger.info(f"LLM determined question count: {question_count}")
            logger.info(f"Reasoning: {question_decision['reasoning']}")
            
            # Step 2: Generate the questions
            question_set = assessment_service.generate_questions(
                course_name=course.name,
                course_description=course.description,
                difficulty=course.difficulty_level,
                num_questions=question_count
            )
            
            logger.info(f"Generated {len(question_set.questions)} questions successfully")
            logger.info("="*60)
            
            # Convert to dict for JSON response
            response_data = {
                'question_count': question_count,
                'question_count_reasoning': question_decision['reasoning'],
                'questions': [q.model_dump() for q in question_set.questions]
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Course.DoesNotExist:
            return Response(
                {'error': 'Course not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error generating initial assessment: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to generate assessment: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EvaluateAssessmentView(APIView):
    """Evaluate initial assessment and generate personalized syllabus with two-layer validation"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Evaluate assessment answers and create enrollment with personalized syllabus.
        
        Expected payload:
        {
            "course_id": 1,
            "course_name": "Web Development",
            "questions": [...],  # Full question objects with correct_answer_index and topic
            "answers": [0, 2, 3, 1, ...],  # User's answer indices (0-3, where 3 is "I don't know")
            "study_method": "real_world" | "theory_depth" | "project_based" | "custom",
            "custom_study_method": "..." (required if study_method is "custom")
        }
        
        Returns:
        {
            "enrollment_id": 1,
            "assessment_result": {
                "knowledge_level": "Basic",
                "knowledge_percentage": 45.5,
                "correct_answers": 3,
                "incorrect_answers": 2,
                "dont_know_answers": 3,
                "known_topics": [...],
                "weak_topics": [...],
                "unknown_topics": [...]
            },
            "syllabus": {
                "course_name": "...",
                "study_method": "...",
                "total_modules": 5,
                "total_estimated_hours": 12.5,
                "modules": [...]
            },
            "message": "..."
        }
        """
        from .services.pre_assessment_service import PreKnowledgeAssessment
        from .services.syllabus_service import SyllabusGenerator
        
        course_id = request.data.get('course_id')
        course_name = request.data.get('course_name')
        questions = request.data.get('questions')
        answers = request.data.get('answers')
        study_method = request.data.get('study_method', 'real_world')
        custom_study_method = request.data.get('custom_study_method', '')
        
        if not all([course_id, course_name, questions, answers]):
            return Response(
                {'error': 'course_id, course_name, questions, and answers are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate study_method
        valid_study_methods = ['real_world', 'theory_depth', 'project_based', 'custom']
        if study_method not in valid_study_methods:
            return Response(
                {'error': f'study_method must be one of: {", ".join(valid_study_methods)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate custom_study_method if needed
        if study_method == 'custom' and not custom_study_method:
            return Response(
                {'error': 'custom_study_method is required when study_method is "custom"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            course = Course.objects.get(pk=course_id)
            user = request.user
            
            # Check if this is a learnable sub-topic
            if not course.is_sub_topic:
                sub_topics = Course.objects.filter(
                    is_sub_topic=True,
                    parent_topic_name=course.title
                )
                return Response({
                    'error': f"Cannot enroll in '{course.title}' directly.",
                    'message': f"We can't teach you the entire '{course.title}' topic. Please choose from the individual sub-topics below.",
                    'learnable': False,
                    'suggested_sub_topics': CourseSerializer(sub_topics, many=True).data
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if already enrolled
            existing_enrollment = Enrollment.objects.filter(
                user=user,
                course=course
            ).first()
            
            if existing_enrollment:
                return Response(
                    {'error': 'Already enrolled in this sub-topic'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info("="*60)
            logger.info("EvaluateAssessmentView: Evaluating assessment")
            logger.info(f"Course: {course_name}")
            logger.info(f"Questions: {len(questions)}, Answers: {len(answers)}")
            logger.info(f"Study method: {study_method}")
            logger.info("="*60)
            
            # Step 1: Evaluate assessment locally
            assessment_service = PreKnowledgeAssessment()
            assessment_result = assessment_service.evaluate_assessment(
                questions=questions,
                user_answers=answers
            )
            
            logger.info(f"Assessment Result: {assessment_result.knowledge_level} ({assessment_result.knowledge_percentage:.1f}%)")
            logger.info(f"Known topics: {len(assessment_result.known_topics)}, Weak: {len(assessment_result.weak_topics)}, Unknown: {len(assessment_result.unknown_topics)}")
            
            # Step 2: Generate personalized syllabus with two-layer validation
            logger.info("Generating personalized syllabus with two-layer validation...")
            syllabus_generator = SyllabusGenerator()
            
            # Convert assessment result to dict for syllabus generation
            assessment_result_dict = assessment_service.result_to_dict(assessment_result)
            
            syllabus, attempt_history = syllabus_generator.generate_syllabus(
                course_name=course.name,
                course_description=course.description,
                difficulty=course.difficulty_level,
                study_method=study_method,
                custom_study_method=custom_study_method,
                assessment_result=assessment_result_dict,
                max_attempts=3
            )
            
            logger.info(f"Syllabus generated: {syllabus.total_modules} modules, {syllabus.total_estimated_hours:.1f} hrs")
            logger.info(f"Generation attempts: {len(attempt_history)}")
            
            # Convert syllabus to dict for storage
            syllabus_dict = syllabus_generator.syllabus_to_dict(syllabus)
            
            # Map knowledge level to Enrollment.KnowledgeLevel choices
            knowledge_level_map = {
                'None': 'beginner',
                'Basic': 'beginner',
                'Intermediate': 'intermediate',
                'Advanced': 'advanced',
            }
            diagnosed_level = knowledge_level_map.get(assessment_result.knowledge_level, 'beginner')
            
            # Determine learning style based on knowledge level
            level_to_style = {
                'beginner': 'videos',
                'intermediate': 'summary',
                'advanced': 'mindmap',
            }
            learning_style = level_to_style.get(diagnosed_level, 'summary')
            
            # Create enrollment with new fields
            enrollment = Enrollment.objects.create(
                user=user,
                course=course,
                diagnosed_level=diagnosed_level,
                learning_style_override=learning_style,
                study_method_preference=study_method,
                custom_study_method=custom_study_method,
                assessment_questions_count=len(questions),
                status='active'
            )
            
            logger.info(f"Enrollment created: ID={enrollment.id}")
            
            # Create backward-compatible flat roadmap
            roadmap_data = {
                "topics": [
                    {
                        "topic_name": mod.get("module_name", ""),
                        "level": diagnosed_level,
                        "description": mod.get("module_description", ""),
                    }
                    for mod in syllabus_dict.get("modules", [])
                ]
            }
            
            roadmap = LearningRoadmap.objects.create(
                enrollment=enrollment,
                roadmap_data=roadmap_data,
                is_active=True,
                version=1
            )
            
            # Create personalized syllabus with new structure
            personalized_syllabus = PersonalizedSyllabus.objects.create(
                enrollment=enrollment,
                syllabus_data=syllabus_dict,
                generated_by_model=getattr(settings, 'OLLAMA_MODEL', 'llama3:8b')
            )
            
            logger.info(f"PersonalizedSyllabus created: ID={personalized_syllabus.id}")
            
            # Store topic breakdown in QuizAttempt for analytics
            quiz_attempt = QuizAttempt.objects.create(
                enrollment=enrollment,
                attempt_type='diagnostic',
                score_percent=assessment_result.knowledge_percentage,
                correct_answers=assessment_result.correct_answers,
                total_questions=assessment_result.total_questions,
                weak_areas={
                    'known_topics': assessment_result.known_topics,
                    'weak_topics': assessment_result.weak_topics,
                    'unknown_topics': assessment_result.unknown_topics,
                    'knowledge_level': assessment_result.knowledge_level
                }
            )
            
            # Log activity
            ActivityLog.objects.create(
                user=user,
                activity_type='course_started',
                title=f'Started {course.title}',
                description=f'Completed pre-knowledge assessment for {course.title}',
                metadata={
                    'course_id': course.id,
                    'knowledge_level': assessment_result.knowledge_level,
                    'knowledge_percentage': assessment_result.knowledge_percentage,
                    'study_method': study_method
                }
            )
            
            logger.info("="*60)
            logger.info("EvaluateAssessmentView: Complete!")
            logger.info("="*60)
            
            return Response({
                'enrollment_id': enrollment.id,
                'assessment_result': assessment_result_dict,
                'syllabus': syllabus_dict,
                'roadmap': roadmap_data,  # Backward compatibility
                'message': 'Enrollment created successfully with personalized syllabus'
            }, status=status.HTTP_201_CREATED)
            
        except Course.DoesNotExist:
            return Response(
                {'error': 'Course not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in EvaluateAssessmentView: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to process assessment: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
        except Course.DoesNotExist:
            return Response(
                {'error': 'Course not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error evaluating assessment: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to evaluate assessment: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GetSyllabusView(APIView):
    """Retrieve the personalized syllabus for an enrollment"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, enrollment_id):
        try:
            enrollment = Enrollment.objects.get(pk=enrollment_id, user=request.user)
        except Enrollment.DoesNotExist:
            return Response(
                {'error': 'Enrollment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            syllabus = PersonalizedSyllabus.objects.get(enrollment=enrollment)
        except PersonalizedSyllabus.DoesNotExist:
            return Response(
                {'error': 'No syllabus found for this enrollment'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            'enrollment_id': enrollment.id,
            'course_name': enrollment.course.title,
            'syllabus': syllabus.syllabus_data,
            'generated_by_model': syllabus.generated_by_model,
            'total_modules': syllabus.total_modules,
            'total_topics': syllabus.total_topics,
            'created_at': syllabus.created_at,
        })


class GenerateTopicContentView(APIView):
    """Generate educational content for a specific topic"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Generate content for a topic.
        
        Expected payload:
        {
            "enrollment_id": 1,
            "module_id": 5,
            "topic_name": "Introduction to HTML"
        }
        
        Returns:
        {
            "content": "Markdown formatted content..."
        }
        """
        from .services.assessment_service import get_assessment_service
        
        enrollment_id = request.data.get('enrollment_id')
        module_id = request.data.get('module_id')
        topic_name = request.data.get('topic_name')
        
        if enrollment_id is None or module_id is None or not topic_name:
            return Response(
                {'error': 'enrollment_id, module_id, and topic_name are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            enrollment = Enrollment.objects.get(pk=enrollment_id, user=request.user)
            
            # Get or create the Module using the order field
            # Modules are stored in PersonalizedSyllabus JSON, not always in DB
            try:
                module = Module.objects.get(course=enrollment.course, order=module_id)
            except Module.DoesNotExist:
                # Create module dynamically from syllabus data
                try:
                    syllabus_obj = PersonalizedSyllabus.objects.get(enrollment=enrollment)
                    syllabus_data = syllabus_obj.syllabus_data
                    
                    # Find the module by order in the syllabus JSON
                    matching_module = None
                    for mod in syllabus_data.get('modules', []):
                        if mod.get('order') == module_id:
                            matching_module = mod
                            break
                    
                    if not matching_module:
                        return Response(
                            {'error': f'Module with order {module_id} not found in syllabus'},
                            status=status.HTTP_404_NOT_FOUND
                        )
                    
                    # Create the Module record
                    module = Module.objects.create(
                        course=enrollment.course,
                        title=matching_module.get('module_name', f'Module {module_id}'),
                        description=matching_module.get('description', ''),
                        order=module_id,
                        difficulty_level=matching_module.get('difficulty_level', 'beginner'),
                        estimated_duration_minutes=matching_module.get('estimated_duration_minutes', 60),
                        is_generated=True
                    )
                except PersonalizedSyllabus.DoesNotExist:
                    return Response(
                        {'error': 'Syllabus not found for this enrollment'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            
            # ── Check if content already exists in DB ──────────────────────
            try:
                existing_lesson = Lesson.objects.filter(
                    module=module,
                    title=topic_name,
                ).exclude(content__isnull=True).exclude(content__exact='').first()
                
                if existing_lesson:
                    print(f"*** Returning cached content for '{topic_name}' ({len(existing_lesson.content)} chars) ***")
                    return Response({
                        'lesson_id': existing_lesson.id,
                        'content': existing_lesson.content
                    }, status=status.HTTP_200_OK)
            except Exception:
                pass  # Fall through to generation if check fails
            
            # ── No cached content – generate with AI ─────────────────────
            # Get study method from enrollment
            study_method = enrollment.learning_style_override or 'summary'
            
            # Extract topic description from syllabus data
            topic_description = ""
            try:
                syllabus_obj = PersonalizedSyllabus.objects.get(enrollment=enrollment)
                syllabus_data = syllabus_obj.syllabus_data
                
                # Find the topic in the syllabus JSON
                for mod in syllabus_data.get('modules', []):
                    if mod.get('order') == module_id:
                        for topic in mod.get('topics', []):
                            if topic.get('topic_name') == topic_name:
                                topic_description = topic.get('description', '')
                                break
                        break
            except PersonalizedSyllabus.DoesNotExist:
                pass  # Continue without description if not found
            
            print("\n**************************************************")
            print("*** GenerateTopicContentView: Calling assessment service ***")
            print(f"*** Course: {enrollment.course.title} ***")
            print(f"*** Topic: {topic_name} ***")
            print(f"*** Topic Description: {topic_description} ***")
            print(f"*** Study method: {study_method} ***")
            print("**************************************************")
            # Generate content
            assessment_service = get_assessment_service()
            content = assessment_service.generate_topic_content(
                enrollment.course.title,
                topic_name,
                study_method,
                topic_description
            )
            print(f"*** Content generated: {len(content)} chars ***")
            print("**************************************************\n")
            
            # Create or update lesson (keyed by module + title so each topic is stored separately)
            existing_count = Lesson.objects.filter(module=module).count()
            lesson, created = Lesson.objects.get_or_create(
                module=module,
                title=topic_name,
                defaults={
                    'order': existing_count + 1,
                    'content': content,
                }
            )
            
            if not created:
                lesson.content = content
                lesson.save()
            
            # Count existing note resources to create unique title
            existing_notes_count = Resource.objects.filter(
                lesson=lesson,
                resource_type='notes',
            ).count()
            
            # Always create a new Resource of type 'notes' (allow multiple notes per topic)
            Resource.objects.create(
                lesson=lesson,
                resource_type='notes',
                title=f'{topic_name} - Notes #{existing_notes_count + 1}',
                content_text=content,
                is_generated=True,
                generation_model='phi3:mini',
            )
            logger.info(f"✅ Created notes resource #{existing_notes_count + 1} for: {topic_name}")
            
            return Response({
                'lesson_id': lesson.id,
                'content': content
            }, status=status.HTTP_200_OK)
            
        except Enrollment.DoesNotExist:
            return Response(
                {'error': 'Enrollment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error generating topic content: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to generate content: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerateTopicQuizView(APIView):
    """Generate quiz for a specific topic and save questions to DB"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Generate quiz for a topic based on its content, persist every
        question in the Question table, and return them *without*
        correct_answer so the browser never sees the answers.

        Expected payload:
        {
            "lesson_id": 10,
            "topic_name": "Introduction to HTML"
        }
        
        Returns:
        {
            "questions": [
                {
                    "id": 42,
                    "question": "...",
                    "options": ["A", "B", "C", "D"]
                }
            ]
        }
        """
        from .services.assessment_service import get_assessment_service
        
        lesson_id = request.data.get('lesson_id')
        topic_name = request.data.get('topic_name')
        
        if not all([lesson_id, topic_name]):
            return Response(
                {'error': 'lesson_id and topic_name are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            lesson = Lesson.objects.get(pk=lesson_id)
            content = lesson.content
            
            if not content:
                return Response(
                    {'error': 'Lesson content not found. Generate content first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # We need the module's course to save Question records
            module = lesson.module
            course = module.course
            
            print("\n**************************************************")
            print("*** GenerateTopicQuizView: Calling assessment service ***")
            print(f"*** Lesson ID: {lesson_id} ***")
            print(f"*** Topic: {topic_name} ***")
            print(f"*** Content length: {len(content)} chars ***")
            print("**************************************************")
            # Generate quiz via AI
            assessment_service = get_assessment_service()
            quiz_data = assessment_service.generate_topic_quiz(topic_name, content)
            raw_questions = quiz_data.get('questions', [])
            print(f"*** Quiz generated with {len(raw_questions)} questions ***")

            # ── Persist every question in the DB ──────────────────────
            saved_questions = []
            for q in raw_questions:
                options_list = q.get('options', [])
                correct_text = q.get('correct_answer', '')

                # Determine correct_answer_index from the option list
                try:
                    correct_idx = next(
                        i for i, o in enumerate(options_list)
                        if o.strip().upper() == correct_text.strip().upper()
                    )
                except StopIteration:
                    correct_idx = 0  # fallback

                db_question = Question.objects.create(
                    course=course,
                    module=module,
                    question_type='topic_quiz',
                    difficulty='intermediate',
                    question_text=q.get('question', ''),
                    options=options_list,
                    correct_answer_index=correct_idx,
                    explanation='',
                    is_generated=True,
                )
                saved_questions.append(db_question)

            print(f"*** Saved {len(saved_questions)} questions to DB ***")
            print("**************************************************\n")

            # ── Build response WITHOUT correct_answer ─────────────────
            response_questions = [
                {
                    'id': dbq.id,
                    'question': dbq.question_text,
                    'options': dbq.options,
                }
                for dbq in saved_questions
            ]
            
            return Response({'questions': response_questions}, status=status.HTTP_200_OK)
            
        except Lesson.DoesNotExist:
            return Response(
                {'error': 'Lesson not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error generating topic quiz: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to generate quiz: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EvaluateTopicQuizView(APIView):
    """Evaluate topic quiz using server-side answers from the DB"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Evaluate topic quiz answers by looking up correct answers from
        the Question table.  Creates QuizAttempt + individual QuizAnswer
        records.

        Expected payload:
        {
            "enrollment_id": 1,
            "module_id": 5,
            "question_ids": [42, 43, 44, 45, 46],
            "answers": ["Option A", "Option B", ...]
        }
        
        Returns:
        {
            "evaluation": {
                "score": "4/5",
                "score_percent": 80,
                "weak_areas": [...]
            },
            "refined_roadmap": { ... }   // only when weak areas exist
        }
        """
        from .services.assessment_service import get_assessment_service
        
        enrollment_id = request.data.get('enrollment_id')
        module_id = request.data.get('module_id')
        question_ids = request.data.get('question_ids')
        answers = request.data.get('answers')
        
        if not all([enrollment_id, module_id, question_ids, answers]):
            return Response(
                {'error': 'enrollment_id, module_id, question_ids, and answers are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(question_ids) != len(answers):
            return Response(
                {'error': 'question_ids and answers must have the same length'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            enrollment = Enrollment.objects.get(pk=enrollment_id, user=request.user)
            
            # Get or create the Module using the order field
            try:
                module = Module.objects.get(course=enrollment.course, order=module_id)
            except Module.DoesNotExist:
                # Create module dynamically from syllabus data
                try:
                    syllabus_obj = PersonalizedSyllabus.objects.get(enrollment=enrollment)
                    syllabus_data = syllabus_obj.syllabus_data
                    
                    # Find the module by order in the syllabus JSON
                    matching_module = None
                    for mod in syllabus_data.get('modules', []):
                        if mod.get('order') == module_id:
                            matching_module = mod
                            break
                    
                    if not matching_module:
                        return Response(
                            {'error': f'Module with order {module_id} not found in syllabus'},
                            status=status.HTTP_404_NOT_FOUND
                        )
                    
                    # Create the Module record
                    module = Module.objects.create(
                        course=enrollment.course,
                        title=matching_module.get('module_name', f'Module {module_id}'),
                        description=matching_module.get('description', ''),
                        order=module_id,
                        difficulty_level=matching_module.get('difficulty_level', 'beginner'),
                        estimated_duration_minutes=matching_module.get('estimated_duration_minutes', 60),
                        is_generated=True
                    )
                except PersonalizedSyllabus.DoesNotExist:
                    return Response(
                        {'error': 'Syllabus not found for this enrollment'},
                        status=status.HTTP_404_NOT_FOUND
                    )

            # ── Fetch questions from DB ──────────────────────────────
            db_questions = Question.objects.filter(id__in=question_ids)
            q_map = {q.id: q for q in db_questions}

            if len(q_map) != len(question_ids):
                return Response(
                    {'error': 'One or more question IDs are invalid'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ── Evaluate each answer server-side ─────────────────────
            correct_count = 0
            weak_areas = []
            answer_records = []   # (question, selected_index, is_correct)

            for qid, user_answer in zip(question_ids, answers):
                q = q_map[qid]
                correct_text = q.options[q.correct_answer_index] if q.options else ''
                is_correct = user_answer.strip().upper() == correct_text.strip().upper()

                if is_correct:
                    correct_count += 1
                else:
                    weak_areas.append(q.question_text)

                # Determine selected_option_index
                selected_idx = None
                for idx, opt in enumerate(q.options or []):
                    if opt.strip().upper() == user_answer.strip().upper():
                        selected_idx = idx
                        break

                answer_records.append((q, selected_idx, is_correct))

            total_questions = len(question_ids)
            score_percent = round((correct_count / total_questions) * 100) if total_questions else 0

            evaluation = {
                'score': f'{correct_count}/{total_questions}',
                'correct_count': correct_count,
                'total_questions': total_questions,
                'score_percent': score_percent,
                'weak_areas': weak_areas,
            }

            print("\n**************************************************")
            print("*** EvaluateTopicQuizView: Server-side evaluation ***")
            print(f"*** Enrollment ID: {enrollment_id}, Module ID: {module_id} ***")
            print(f"*** Score: {correct_count}/{total_questions} ({score_percent}%) ***")
            print("**************************************************\n")
            
            # ── Create QuizAttempt + QuizAnswer records ──────────────
            quiz_attempt = QuizAttempt.objects.create(
                enrollment=enrollment,
                module=module,
                attempt_type='topic_quiz',
                score_percent=score_percent,
                total_questions=total_questions,
                correct_answers=correct_count,
                weak_areas=weak_areas,
            )
            quiz_attempt.completed_at = timezone.now()
            quiz_attempt.save()

            for q_obj, sel_idx, is_c in answer_records:
                QuizAnswer.objects.create(
                    attempt=quiz_attempt,
                    question=q_obj,
                    selected_option_index=sel_idx,
                    is_correct=is_c,
                )
            
            # Update module progress
            module_progress, created = ModuleProgress.objects.get_or_create(
                enrollment=enrollment,
                module=module,
                defaults={'status': 'completed'}
            )
            
            if not created:
                module_progress.status = 'completed'
                module_progress.save()
            
            # Get remaining modules (topics)
            remaining_modules = Module.objects.filter(
                course=enrollment.course,
                order__gt=module.order
            ).order_by('order')
            
            refined_roadmap = None
            assessment_service = get_assessment_service()
            if remaining_modules.exists() and evaluation['weak_areas']:
                # Convert modules to topic format
                remaining_topics = [
                    {
                        'topic_name': m.title,
                        'level': m.difficulty_level
                    }
                    for m in remaining_modules
                ]
                
                # Refine roadmap
                refined_roadmap = assessment_service.refine_roadmap(
                    enrollment.course.title,
                    remaining_topics,
                    evaluation['weak_areas']
                )
                
                # Update roadmap
                roadmap = enrollment.roadmaps.filter(is_active=True).first()
                if roadmap:
                    # Deactivate old roadmap
                    roadmap.is_active = False
                    roadmap.save()
                    
                    # Create new version
                    LearningRoadmap.objects.create(
                        enrollment=enrollment,
                        roadmap_data=refined_roadmap,
                        is_active=True,
                        version=roadmap.version + 1
                    )
            
            # Update overall progress
            total_modules = enrollment.course.modules.count()
            completed_modules = enrollment.module_progresses.filter(
                status='completed'
            ).count()
            
            if total_modules > 0:
                progress = (completed_modules / total_modules) * 100
                enrollment.overall_progress = progress
                enrollment.save()
            
            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                activity_type='quiz_completed',
                title=f'Completed quiz for {module.title}',
                description=f'Completed quiz for {module.title}',
                metadata={'course_id': enrollment.course.id, 'module_id': module.id}
            )
            
            response_data = {
                'evaluation': evaluation,
                'progress_updated': True
            }
            
            if refined_roadmap:
                response_data['refined_roadmap'] = refined_roadmap
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Enrollment.DoesNotExist:
            return Response(
                {'error': 'Enrollment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error evaluating topic quiz: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to evaluate quiz: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerateRemediationContentView(APIView):
    """Generate focused remediation content for weak sub-topics after quiz"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Generate remediation content for sub-topics the user struggled with.
        
        Expected payload:
        {
            "enrollment_id": 1,
            "lesson_id": 10,
            "topic_name": "Introduction to HTML",
            "weak_areas": ["Question about CSS selectors...", "Question about box model..."]
        }
        
        Returns:
        {
            "remediation_notes": [
                {
                    "sub_topic": "CSS Selectors Explained",
                    "content": "Detailed markdown content..."
                }
            ]
        }
        """
        from .services.assessment_service import get_assessment_service
        
        enrollment_id = request.data.get('enrollment_id')
        lesson_id = request.data.get('lesson_id')
        topic_name = request.data.get('topic_name')
        weak_areas = request.data.get('weak_areas', [])
        
        if not all([enrollment_id, lesson_id, topic_name]) or not weak_areas:
            return Response(
                {'error': 'enrollment_id, lesson_id, topic_name, and non-empty weak_areas are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            enrollment = Enrollment.objects.get(pk=enrollment_id, user=request.user)
            lesson = Lesson.objects.get(pk=lesson_id)
            
            original_content = lesson.content or ''
            
            print("\n**************************************************")
            print("*** GenerateRemediationContentView ***")
            print(f"*** Topic: {topic_name} ***")
            print(f"*** Weak areas: {len(weak_areas)} ***")
            print("**************************************************")
            
            assessment_service = get_assessment_service()
            result = assessment_service.generate_remediation_content(
                enrollment.course.title,
                topic_name,
                weak_areas,
                original_content
            )
            
            print(f"*** Remediation notes generated: {len(result.get('remediation_notes', []))} ***")
            print("**************************************************\n")
            
            return Response(result, status=status.HTTP_200_OK)
            
        except Enrollment.DoesNotExist:
            return Response(
                {'error': 'Enrollment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Lesson.DoesNotExist:
            return Response(
                {'error': 'Lesson not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error generating remediation content: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to generate remediation content: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================================
# PODCAST GENERATION VIEWS
# ============================================================================

class GeneratePersonaOptionsView(APIView):
    """Generate persona options for podcast"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Generate 3 persona pair options based on content
        
        Expected payload:
        {
            "text": "Content to analyze..."
        }
        """
        try:
            text = request.data.get('text', '')
            
            if not text:
                return Response(
                    {'error': 'Text content is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            service = get_podcast_service()
            options = service.generate_persona_options(text)
            
            return Response({
                'options': options
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating persona options: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to generate persona options: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerateScenarioOptionsView(APIView):
    """Generate scenario options for podcast"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Generate 3 scenario options based on content and personas
        
        Expected payload:
        {
            "text": "Content to analyze...",
            "personas": {
                "person1": "Expert",
                "person2": "Novice"
            }
        }
        """
        try:
            text = request.data.get('text', '')
            personas = request.data.get('personas', None)
            
            if not text:
                return Response(
                    {'error': 'Text content is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            service = get_podcast_service()
            options = service.generate_scenario_options(text, personas)
            
            return Response({
                'options': options
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating scenario options: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to generate scenario options: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GeneratePodcastView(APIView):
    """Generate complete podcast from content"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Generate a complete podcast
        
        Expected payload:
        {
            "text": "Content to create podcast from...",
            "instruction": "Deep dive analysis",  // optional
            "person1": "Professor",               // optional
            "person2": "Student",                 // optional
            "lesson_id": 123,                      // optional
            "topic_name": "Introduction to ML"    // optional
        }
        """
        try:
            text = request.data.get('text', '')
            instruction = request.data.get('instruction', None)
            person1 = request.data.get('person1', None)
            person2 = request.data.get('person2', None)
            lesson_id = request.data.get('lesson_id', None)
            topic_name = request.data.get('topic_name', None)
            
            if not text:
                return Response(
                    {'error': 'Text content is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            service = get_podcast_service()
            audio_file_path = service.generate_podcast(
                text=text,
                instruction=instruction,
                person1=person1,
                person2=person2
            )
            
            if not audio_file_path:
                return Response(
                    {'error': 'Failed to generate podcast'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Convert absolute path to relative media URL
            import os
            from django.conf import settings
            
            relative_path = os.path.relpath(
                audio_file_path,
                settings.MEDIA_ROOT
            )
            audio_url = f"/media/{relative_path.replace(os.sep, '/')}"
            
            # Create Resource record if linked to a lesson
            if lesson_id:
                try:
                    from django.core.files import File as DjangoFile
                    lesson = Lesson.objects.get(pk=lesson_id)
                    
                    # Count existing podcast resources to create unique title
                    existing_count = Resource.objects.filter(
                        lesson=lesson,
                        resource_type='audio',
                    ).count()
                    
                    # Always create a new resource (allow multiple podcasts per topic)
                    title = f"{topic_name or 'Topic'} - Podcast #{existing_count + 1}"
                    file_size = os.path.getsize(audio_file_path) if os.path.exists(audio_file_path) else 0
                    
                    # Get audio duration
                    duration = None
                    try:
                        from moviepy import AudioFileClip
                        audio_clip = AudioFileClip(audio_file_path)
                        duration = int(audio_clip.duration)
                        audio_clip.close()
                    except Exception:
                        pass
                    
                    with open(audio_file_path, 'rb') as f:
                        resource = Resource.objects.create(
                            lesson=lesson,
                            resource_type='audio',
                            title=title,
                            content_text=f"Podcast: {person1 or 'Speaker 1'} & {person2 or 'Speaker 2'}",
                            content_json={
                                'person1': person1,
                                'person2': person2,
                                'instruction': instruction
                            },
                            file_size_bytes=file_size,
                            duration_seconds=duration,
                            is_generated=True,
                            generation_model='ollama + edge-tts'
                        )
                        resource.file.save(
                            os.path.basename(audio_file_path),
                            DjangoFile(f),
                            save=True
                        )
                    logger.info(f"✅ Created podcast resource #{existing_count + 1} for: {topic_name}")
                except Lesson.DoesNotExist:
                    logger.warning(f"Lesson {lesson_id} not found, skipping Resource creation")
                except Exception as resource_error:
                    logger.error(f"❌ Failed to create Resource record: {resource_error}", exc_info=True)
            
            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                activity_type='podcast_generated',
                title='Generated Podcast',
                description='Generated audio podcast from content',
                metadata={'audio_url': audio_url}
            )
            
            return Response({
                'audio_url': audio_url,
                'message': 'Podcast generated successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating podcast: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to generate podcast: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================================
# RAG CHATBOT VIEW
# ============================================================================

class ChatWithContextView(APIView):
    """RAG-based chatbot that answers questions using generated topic content as context"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """
        Chat with AI using generated topic content as context.
        
        Expected payload:
        {
            "message": "What is the main concept here?",
            "context": "The generated lesson content...",
            "topic_name": "Introduction to HTML",
            "course_name": "Web Development",
            "chat_history": [
                {"role": "user", "content": "previous question"},
                {"role": "assistant", "content": "previous answer"}
            ]
        }
        
        Returns:
        {
            "response": "AI assistant's response..."
        }
        """
        from .services.assessment_service import get_assessment_service
        
        message = request.data.get('message', '').strip()
        context = request.data.get('context', '').strip()
        topic_name = request.data.get('topic_name', '')
        course_name = request.data.get('course_name', '')
        chat_history = request.data.get('chat_history', [])
        
        if not message:
            return Response(
                {'error': 'message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not context:
            return Response(
                {'error': 'context (generated content) is required. Generate notes first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            assessment_service = get_assessment_service()
            response_text = assessment_service.chat_with_context(
                message=message,
                context=context,
                topic_name=topic_name,
                course_name=course_name,
                chat_history=chat_history
            )
            
            return Response({
                'response': response_text
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in chat: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to get chat response: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

