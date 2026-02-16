import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { 
  BookOpen, 
  Clock, 
  PlayCircle, 
  CheckCircle, 
  TrendingUp,
  Calendar,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { enrollmentAPI } from '../../services/api';
import type { Enrollment } from '../../types/api';

export default function MyCoursesPage() {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEnrollments();
  }, []);

  const loadEnrollments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await enrollmentAPI.list();
      setEnrollments(response.results || []);
    } catch (err: any) {
      console.error('Failed to load enrollments:', err);
      setError(err.response?.data?.error || 'Failed to load your courses');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { bg: 'bg-blue-100', text: 'text-blue-700', icon: PlayCircle, label: 'In Progress' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Completed' },
      paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock, label: 'Paused' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="ml-64 flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Courses</h1>
          <p className="text-gray-600">Continue your learning journey</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Failed to load courses</h3>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={loadEnrollments}
                className="mt-3 text-sm font-medium text-red-700 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && enrollments.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses yet</h3>
            <p className="text-gray-600 mb-6">Start your learning journey by enrolling in a course</p>
            <button
              onClick={() => navigate('/courses/popular')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Browse Popular Courses
            </button>
          </div>
        )}

        {/* Courses Grid */}
        {!loading && !error && enrollments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => navigate(`/course/${enrollment.id}`)}
              >
                {/* Course Image/Header */}
                <div className="h-40 bg-gradient-to-br from-blue-500 to-purple-600 rounded-t-xl p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors"></div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold text-lg line-clamp-2">
                      {enrollment.course?.title || enrollment.course?.name || 'Course'}
                    </h3>
                  </div>
                </div>

                {/* Course Info */}
                <div className="p-6">
                  {/* Status Badge */}
                  <div className="mb-4">
                    {getStatusBadge(enrollment.status)}
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        Progress
                      </span>
                      <span className="font-semibold text-gray-900">
                        {enrollment.overall_progress || 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                        style={{ width: `${enrollment.overall_progress || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Enrolled {formatDate(enrollment.enrolled_at)}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button className="mt-4 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors group-hover:shadow-md">
                    {enrollment.overall_progress === 0 ? 'Start Learning' : 'Continue Learning'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Summary */}
        {!loading && !error && enrollments.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{enrollments.length}</p>
                  <p className="text-sm text-gray-600">Total Courses</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {enrollments.filter((e) => e.status === 'completed').length}
                  </p>
                  <p className="text-sm text-gray-600">Completed</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(
                      enrollments.reduce((acc, e) => acc + (e.overall_progress || 0), 0) /
                        enrollments.length
                    )}%
                  </p>
                  <p className="text-sm text-gray-600">Avg Progress</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
