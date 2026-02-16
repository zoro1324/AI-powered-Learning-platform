import { Sidebar } from '../components/Sidebar';
import { TrendingUp, CheckCircle2, Clock, Target } from 'lucide-react';

export default function ProgressPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-semibold text-gray-900 mb-2">Your Progress</h1>
            <p className="text-gray-600 text-lg">Track your learning journey and achievements</p>
          </div>

          {/* Overall Progress Card */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 mb-8 text-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-semibold mb-2">Overall Progress</h2>
                <p className="text-blue-100">Keep up the great work!</p>
              </div>
              <div className="text-right">
                <p className="text-5xl font-bold">67%</p>
                <p className="text-blue-100">Complete</p>
              </div>
            </div>
            <div className="w-full h-4 bg-white bg-opacity-20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: '67%' }}></div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Modules Completed</p>
              <p className="text-3xl font-bold text-gray-900">12</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Study Time</p>
              <p className="text-3xl font-bold text-gray-900">24h</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Quizzes Passed</p>
              <p className="text-3xl font-bold text-gray-900">8</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Avg. Score</p>
              <p className="text-3xl font-bold text-gray-900">85%</p>
            </div>
          </div>

          {/* Course Progress */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Course Progress</h2>
            <div className="space-y-6">
              {[
                { name: 'Data Structures', progress: 75, modules: '9/12', color: 'blue' },
                { name: 'Machine Learning Basics', progress: 40, modules: '4/10', color: 'purple' },
                { name: 'Web Development', progress: 20, modules: '2/10', color: 'green' },
                { name: 'Algorithms', progress: 90, modules: '9/10', color: 'orange' },
              ].map((course, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{course.name}</h3>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">{course.modules} modules</span>
                      <span className="text-sm font-medium text-gray-900">{course.progress}%</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r from-${course.color}-500 to-${course.color}-600`}
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Recent Achievements</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Quick Learner', desc: 'Complete 3 modules in a day', icon: '⚡' },
                { title: 'Perfect Score', desc: 'Score 100% on a quiz', icon: '🎯' },
                { title: 'Consistent', desc: '7 day learning streak', icon: '🔥' },
              ].map((achievement, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-6 text-center hover:shadow-lg transition-all">
                  <div className="text-5xl mb-4">{achievement.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-2">{achievement.title}</h3>
                  <p className="text-sm text-gray-600">{achievement.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
