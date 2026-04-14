import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { TrendingUp, CheckCircle2, Clock, Target, Loader2, BookOpen, Award } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchDashboard } from '../../store/slices/courseSlice';
import { fetchModuleProgress, fetchUserAchievements } from '../../store/slices/progressSlice';

export default function ProgressPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { dashboard, loading: courseLoading } = useAppSelector((state) => state.course);
  const { moduleProgress, achievements, loading: progressLoading } = useAppSelector((state) => state.progress);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    dispatch(fetchDashboard());
    dispatch(fetchUserAchievements());
    dispatch(fetchModuleProgress({}));
  }, [dispatch, isAuthenticated, navigate]);

  const loading = courseLoading || progressLoading;

  if (loading && !dashboard) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="app-main flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-700" />
        </main>
      </div>
    );
  }

  const stats = dashboard?.stats;
  const overallProgress = stats?.average_progress || 0;

  // Group module progress by enrollment/course
  const activeEnrollments = dashboard?.active_enrollments || [];

  // Compute completed modules count
  const completedModules = moduleProgress.filter((p) => p.status === 'completed').length;

  // Compute average quiz score from module progress


  // Color palette for course progress bars
  const progressColors = [
    { from: 'from-neutral-700', to: 'to-neutral-800', bg: 'bg-neutral-900' },
    { from: 'from-neutral-700', to: 'to-neutral-800', bg: 'bg-purple-500' },
    { from: 'from-neutral-700', to: 'to-neutral-800', bg: 'bg-green-500' },
    { from: 'from-orange-500', to: 'to-orange-600', bg: 'bg-orange-500' },
    { from: 'from-pink-500', to: 'to-pink-600', bg: 'bg-pink-500' },
  ];

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="app-content">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-semibold text-neutral-900 mb-2">Your Progress</h1>
            <p className="text-neutral-600 text-lg">Track your learning journey and achievements</p>
          </div>

          {/* Overall Progress Card */}
          <div className="bg-neutral-900 rounded-2xl p-8 mb-8 text-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-semibold mb-2">Overall Progress</h2>
                <p className="text-neutral-200">
                  {overallProgress >= 80
                    ? 'Outstanding work! Almost there!'
                    : overallProgress >= 50
                      ? 'Great progress! Keep it up!'
                      : overallProgress > 0
                        ? 'Good start! Keep learning!'
                        : 'Start a course to track your progress!'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-5xl font-bold">{Math.round(overallProgress)}%</p>
                <p className="text-neutral-200">Complete</p>
              </div>
            </div>
            <div className="w-full h-4 bg-white bg-opacity-20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-neutral-600 text-sm mb-1">Modules Completed</p>
              <p className="text-3xl font-bold text-neutral-900">{completedModules}</p>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-neutral-200 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-neutral-700" />
                </div>
              </div>
              <p className="text-neutral-600 text-sm mb-1">Study Time</p>
              <p className="text-3xl font-bold text-neutral-900">{stats?.study_time_hours || 0}h</p>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-neutral-600 text-sm mb-1">Active Courses</p>
              <p className="text-3xl font-bold text-neutral-900">{stats?.active_courses || 0}</p>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-neutral-600 text-sm mb-1">Streak Days</p>
              <p className="text-3xl font-bold text-neutral-900">{stats?.streak_days || 0}</p>
            </div>
          </div>

          {/* Course Progress */}
          <div className="surface-card p-8 mb-8">
            <h2 className="text-2xl font-semibold text-neutral-900 mb-6">Course Progress</h2>
            {activeEnrollments.length > 0 ? (
              <div className="space-y-6">
                {activeEnrollments.map((enrollment, idx) => {
                  const color = progressColors[idx % progressColors.length];
                  const courseName = enrollment.course?.title || enrollment.course?.name || 'Course';
                  const progress = enrollment.overall_progress || 0;
                  const courseModules = enrollment.course?.modules || [];
                  const completedCount = courseModules.filter((m: any) => {
                    const mp = moduleProgress.find(
                      (p) => p.module?.id === m.id || (p as any).module === m.id
                    );
                    return mp?.status === 'completed';
                  }).length;
                  const totalCount = courseModules.length || enrollment.course?.modules_count || 0;

                  return (
                    <div key={enrollment.id}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-neutral-900">{courseName}</h3>
                        <div className="flex items-center gap-4">
                          {totalCount > 0 && (
                            <span className="text-sm text-neutral-600">
                              {completedCount}/{totalCount} modules
                            </span>
                          )}
                          <span className="text-sm font-medium text-neutral-900">{Math.round(progress)}%</span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${color.from} ${color.to} transition-all duration-500`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-200">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-neutral-500 mb-4">No courses enrolled yet.</p>
                <button
                  onClick={() => navigate('/courses/popular')}
                  className="px-6 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
                >
                  Browse Courses
                </button>
              </div>
            )}
          </div>

          {/* Achievements */}
          <div className="surface-card p-8">
            <h2 className="text-2xl font-semibold text-neutral-900 mb-6">Achievements</h2>
            {achievements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {achievements.map((userAchievement) => (
                  <div
                    key={userAchievement.id}
                    className="border border-neutral-200 rounded-xl p-6 text-center hover:shadow-lg transition-all"
                  >
                    <div className="text-5xl mb-4">
                      {userAchievement.achievement?.icon || '🏆'}
                    </div>
                    <h3 className="font-semibold text-neutral-900 mb-2">
                      {userAchievement.achievement?.name || 'Achievement'}
                    </h3>
                    <p className="text-sm text-neutral-600">
                      {userAchievement.achievement?.description || 'Keep learning to earn more!'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Earned {new Date(userAchievement.earned_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-200">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-neutral-500 mb-2">No achievements yet</p>
                <p className="text-sm text-gray-400">Complete modules and courses to earn achievements!</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
