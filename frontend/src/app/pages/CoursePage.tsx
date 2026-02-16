import { useNavigate, useParams } from 'react-router';
import {
  BookOpen,
  Clock,
  Layers,
  GraduationCap,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAppSelector } from '../../store';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { cn } from '../components/ui/utils';

export default function CoursePage() {
  const navigate = useNavigate();
  const { enrollmentId } = useParams();
  const { syllabus, courseName, topicCompletion } = useAppSelector(
    (state) => state.syllabus
  );

  if (!syllabus) return null;

  const totalTopics = syllabus.modules.reduce(
    (sum, m) => sum + m.topics.length,
    0
  );
  const completedTopics = Object.values(topicCompletion).filter(Boolean).length;
  const overallProgress =
    totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const getModuleProgress = (mIdx: number, topicsCount: number) => {
    let completed = 0;
    for (let t = 0; t < topicsCount; t++) {
      if (topicCompletion[`${mIdx}-${t}`]) completed++;
    }
    return topicsCount > 0 ? Math.round((completed / topicsCount) * 100) : 0;
  };

  const difficultyColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-700';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700';
      case 'advanced':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Course Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span>AI-Personalized Course</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{courseName}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <Badge
            className={cn(
              'text-xs capitalize',
              difficultyColor(syllabus.knowledge_level)
            )}
          >
            {syllabus.knowledge_level}
          </Badge>
          <span className="flex items-center gap-1">
            <Layers className="w-4 h-4" />
            {syllabus.total_modules} modules
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            {totalTopics} topics
          </span>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Your Progress</h2>
          <span className="text-sm text-gray-500">
            {completedTopics}/{totalTopics} topics completed
          </span>
        </div>
        <Progress value={overallProgress} className="h-3" />
        <p className="text-sm text-gray-500 mt-2">{overallProgress}% complete</p>
      </div>

      {/* Module Cards */}
      <div className="space-y-4">
        {syllabus.modules.map((mod, mIdx) => {
          const progress = getModuleProgress(mIdx, mod.topics.length);

          return (
            <button
              key={mIdx}
              onClick={() =>
                navigate(
                  `/course/${enrollmentId}/module/${mIdx}/topic/0`
                )
              }
              className="w-full bg-white rounded-2xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        progress === 100
                          ? 'bg-green-100'
                          : progress > 0
                          ? 'bg-blue-100'
                          : 'bg-gray-100'
                      )}
                    >
                      {progress === 100 ? (
                        <GraduationCap className="w-5 h-5 text-green-600" />
                      ) : (
                        <BookOpen
                          className={cn(
                            'w-5 h-5',
                            progress > 0 ? 'text-blue-600' : 'text-gray-400'
                          )}
                        />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        Module {mIdx + 1}: {mod.module_name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {mod.description}
                      </p>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors mt-2 shrink-0" />
              </div>

              {/* Module meta */}
              <div className="flex items-center gap-4 mb-3 ml-13">
                <Badge
                  className={cn(
                    'text-[10px] capitalize',
                    difficultyColor(mod.difficulty_level)
                  )}
                >
                  {mod.difficulty_level}
                </Badge>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {mod.topics.length} topics
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {mod.estimated_duration_minutes} min
                </span>
              </div>

              {/* Module progress bar */}
              <div className="ml-13">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-gray-400 mt-1">
                  {progress}% complete
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
