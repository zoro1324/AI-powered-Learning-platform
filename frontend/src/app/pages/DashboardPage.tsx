import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { BookOpen, TrendingUp, Clock, Award, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchDashboard } from '../../store/slices/courseSlice';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { dashboard, loading } = useAppSelector((state) => state.course);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    dispatch(fetchDashboard());
  }, [dispatch, isAuthenticated, navigate]);

  if (loading && !dashboard) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-semibold text-gray-900 mb-2">
              Welcome back, {user?.first_name || 'Learner'}!
            </h1>
            <p className="text-gray-600 text-lg">Here's your learning overview</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Active Courses</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboard?.stats?.active_courses || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Overall Progress</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboard?.stats?.average_progress || 0}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Learning Hours</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboard?.stats?.study_time_hours || 0}h
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Award className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Achievements</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboard?.stats?.achievements_earned || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
            <div className="space-y-4">
              {dashboard?.recent_activities && dashboard.recent_activities.length > 0 ? (
                dashboard.recent_activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <p className="text-gray-900 font-medium">{activity.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>

          {/* Continue Learning */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Continue Learning</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Data Structures', progress: 75, color: 'blue' },
                { title: 'Machine Learning', progress: 40, color: 'purple' },
                { title: 'Web Development', progress: 20, color: 'green' },
              ].map((course, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{course.title}</h3>
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Progress</span>
                      <span className="text-sm font-medium text-gray-900">{course.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      {/* eslint-disable-next-line react/forbid-dom-props */}
                      <div
                        className={`h-full bg-gradient-to-r from-${course.color}-500 to-${course.color}-600 transition-all`}
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                  <button className="mt-4 w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all">
                    Continue
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
