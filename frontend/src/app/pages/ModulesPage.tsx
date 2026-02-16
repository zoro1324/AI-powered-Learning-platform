import { Sidebar } from '../components/Sidebar';
import { Layers, CheckCircle2, Lock, Play } from 'lucide-react';

export default function ModulesPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-semibold text-gray-900 mb-2">Learning Modules</h1>
            <p className="text-gray-600 text-lg">Access all your course modules and materials</p>
          </div>

          {/* Active Course */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Data Structures</h2>
                <p className="text-gray-600">Currently Learning</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">Progress</p>
                <p className="text-3xl font-bold text-gray-900">75%</p>
              </div>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600" style={{ width: '75%' }}></div>
            </div>
          </div>

          {/* Modules List */}
          <div className="space-y-4">
            {[
              { id: 1, title: 'Introduction to Data Structures', status: 'completed', lessons: 5, duration: '45 min' },
              { id: 2, title: 'Arrays and Strings', status: 'completed', lessons: 6, duration: '60 min' },
              { id: 3, title: 'Linked Lists', status: 'completed', lessons: 8, duration: '90 min' },
              { id: 4, title: 'Stacks and Queues', status: 'in-progress', lessons: 7, duration: '75 min' },
              { id: 5, title: 'Trees and Graphs', status: 'locked', lessons: 10, duration: '120 min' },
              { id: 6, title: 'Hash Tables', status: 'locked', lessons: 6, duration: '60 min' },
              { id: 7, title: 'Sorting Algorithms', status: 'locked', lessons: 8, duration: '90 min' },
              { id: 8, title: 'Searching Algorithms', status: 'locked', lessons: 7, duration: '75 min' },
            ].map((module) => (
              <div
                key={module.id}
                className={`bg-white rounded-2xl shadow-lg p-6 transition-all ${
                  module.status === 'locked' ? 'opacity-60' : 'hover:shadow-xl cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-6">
                  {/* Module Number & Status Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                      module.status === 'completed'
                        ? 'bg-green-100'
                        : module.status === 'in-progress'
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}>
                      {module.status === 'completed' ? (
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                      ) : module.status === 'in-progress' ? (
                        <Play className="w-8 h-8 text-blue-600" />
                      ) : (
                        <Lock className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Module Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-gray-500">Module {module.id}</span>
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        module.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : module.status === 'in-progress'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {module.status === 'completed' ? 'Completed' : module.status === 'in-progress' ? 'In Progress' : 'Locked'}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{module.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Layers className="w-4 h-4" />
                        {module.lessons} lessons
                      </span>
                      <span>•</span>
                      <span>{module.duration}</span>
                    </div>
                  </div>

                  {/* Progress Bar (for in-progress modules) */}
                  {module.status === 'in-progress' && (
                    <div className="flex-shrink-0 w-48">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Progress</span>
                        <span className="text-sm font-medium text-gray-900">60%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  {module.status !== 'locked' && (
                    <button className={`px-6 py-3 rounded-xl font-medium transition-all ${
                      module.status === 'completed'
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
                    }`}>
                      {module.status === 'completed' ? 'Review' : 'Continue'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Next Module Suggestion */}
          <div className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-semibold mb-2">Ready for the Next Challenge?</h3>
            <p className="text-blue-100 mb-4">
              Complete Module 4 to unlock Trees and Graphs
            </p>
            <button className="px-6 py-3 bg-white text-blue-600 rounded-xl font-medium hover:bg-blue-50 transition-all">
              Continue Learning
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
