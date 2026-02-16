from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    GenerateVideoView, VideoTaskStatusView,
    RegisterView, CustomTokenObtainPairView, LogoutView,
    UserProfileView, LearningProfileView,
    CourseViewSet, ModuleViewSet, LessonViewSet, ResourceViewSet,
    EnrollmentViewSet, QuestionViewSet, QuizAttemptViewSet, QuizAnswerViewSet,
    ModuleProgressViewSet, LearningRoadmapViewSet, AchievementViewSet,
    UserAchievementViewSet, ActivityLogViewSet, DashboardView,
    InitialAssessmentView, EvaluateAssessmentView, GenerateTopicContentView,
    GenerateTopicQuizView, EvaluateTopicQuizView
)

# Create router for ViewSets
router = DefaultRouter()
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'modules', ModuleViewSet, basename='module')
router.register(r'lessons', LessonViewSet, basename='lesson')
router.register(r'resources', ResourceViewSet, basename='resource')
router.register(r'enrollments', EnrollmentViewSet, basename='enrollment')
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'quiz-attempts', QuizAttemptViewSet, basename='quiz-attempt')
router.register(r'quiz-answers', QuizAnswerViewSet, basename='quiz-answer')
router.register(r'module-progress', ModuleProgressViewSet, basename='module-progress')
router.register(r'learning-roadmaps', LearningRoadmapViewSet, basename='learning-roadmap')
router.register(r'achievements', AchievementViewSet, basename='achievement')
router.register(r'user-achievements', UserAchievementViewSet, basename='user-achievement')
router.register(r'activity-logs', ActivityLogViewSet, basename='activity-log')

urlpatterns = [
    # Authentication
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='auth-token-refresh'),
    
    # User Profile
    path('users/me/', UserProfileView.as_view(), name='user-profile'),
    path('users/me/learning-profile/', LearningProfileView.as_view(), name='learning-profile'),
    
    # Dashboard
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    
    # Video Generation
    path('videos/generate/', GenerateVideoView.as_view(), name='video-generate'),
    path('videos/status/<uuid:task_id>/', VideoTaskStatusView.as_view(), name='video-status'),
    
    # Assessment & Personalized Learning
    path('assessment/initial/', InitialAssessmentView.as_view(), name='assessment-initial'),
    path('assessment/evaluate/', EvaluateAssessmentView.as_view(), name='assessment-evaluate'),
    path('assessment/topic/content/', GenerateTopicContentView.as_view(), name='topic-content'),
    path('assessment/topic/quiz/', GenerateTopicQuizView.as_view(), name='topic-quiz'),
    path('assessment/topic/evaluate/', EvaluateTopicQuizView.as_view(), name='topic-evaluate'),
    
    # Router URLs (all ViewSets)
    path('', include(router.urls)),
]

