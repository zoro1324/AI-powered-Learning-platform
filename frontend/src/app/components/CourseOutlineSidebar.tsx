import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ChevronLeft,
  CheckCircle2,
  PlayCircle,
  Circle,
  Clock,
  BookOpen,
  Menu,
} from 'lucide-react';
import { useAppSelector } from '../../store';
import { ScrollArea } from './ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';

interface CourseOutlineSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function CourseOutlineSidebar({
  collapsed,
  onToggle,
}: CourseOutlineSidebarProps) {
  const navigate = useNavigate();
  const { enrollmentId, moduleIndex, topicIndex } = useParams();
  const currentModuleIdx = moduleIndex ? parseInt(moduleIndex) : -1;
  const currentTopicIdx = topicIndex ? parseInt(topicIndex) : -1;

  const {
    syllabus,
    courseName,
    topicCompletion,
    generatedContent,
  } = useAppSelector((state) => state.syllabus);

  const isTopicComplete = useCallback(
    (mIdx: number, tIdx: number) => !!topicCompletion[`${mIdx}-${tIdx}`],
    [topicCompletion]
  );

  const hasContent = useCallback(
    (mIdx: number, tIdx: number) => !!generatedContent[`${mIdx}-${tIdx}`],
    [generatedContent]
  );

  const getModuleCompletionCount = useCallback(
    (mIdx: number, topicsCount: number) => {
      let completed = 0;
      for (let t = 0; t < topicsCount; t++) {
        if (isTopicComplete(mIdx, t)) completed++;
      }
      return completed;
    },
    [isTopicComplete]
  );

  if (collapsed) {
    return (
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center pt-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={onToggle}>
          <Menu className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  if (!syllabus) {
    return (
      <div className="w-72 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  // Determine default open modules — current module or first module
  const defaultOpenModules = currentModuleIdx >= 0
    ? [`module-${currentModuleIdx}`]
    : ['module-0'];

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-700 -ml-2"
          >
            <Menu className="w-4 h-4 mr-1" />
            <span className="text-xs">Hide menu</span>
          </Button>
        </div>
        <h2 className="font-semibold text-gray-900 text-sm leading-tight">
          {courseName}
        </h2>
      </div>

      {/* Module/Topic List */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <Accordion
          type="multiple"
          defaultValue={defaultOpenModules}
          className="px-2 py-2"
        >
          {syllabus.modules.map((mod, mIdx) => {
            const completedCount = getModuleCompletionCount(mIdx, mod.topics.length);
            const allComplete = completedCount === mod.topics.length;

            return (
              <AccordionItem
                key={`module-${mIdx}`}
                value={`module-${mIdx}`}
                className="border-b-0"
              >
                <AccordionTrigger className="px-3 py-3 hover:no-underline hover:bg-gray-50 rounded-lg text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {allComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
                      )}
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {mod.module_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-6">
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {mod.difficulty_level}
                      </Badge>
                      <span className="text-[10px] text-gray-400">
                        {completedCount}/{mod.topics.length} topics
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <div className="space-y-0.5 ml-2">
                    {mod.topics.map((topic, tIdx) => {
                      const isActive =
                        currentModuleIdx === mIdx && currentTopicIdx === tIdx;
                      const completed = isTopicComplete(mIdx, tIdx);
                      const started = hasContent(mIdx, tIdx);

                      return (
                        <Link
                          key={`topic-${mIdx}-${tIdx}`}
                          to={`/course/${enrollmentId}/module/${mIdx}/topic/${tIdx}`}
                          className={cn(
                            'flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-sm group',
                            isActive
                              ? 'bg-blue-50 border-l-2 border-blue-500'
                              : 'hover:bg-gray-50 border-l-2 border-transparent'
                          )}
                        >
                          {/* Status Icon */}
                          <div className="mt-0.5 shrink-0">
                            {completed ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : isActive || started ? (
                              <PlayCircle className="w-4 h-4 text-blue-500" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-300" />
                            )}
                          </div>

                          {/* Topic Info */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                'text-sm leading-tight',
                                isActive
                                  ? 'text-blue-700 font-medium'
                                  : completed
                                  ? 'text-gray-500'
                                  : 'text-gray-700'
                              )}
                            >
                              {topic.topic_name}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              ~5 min
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>

      {/* Back to Dashboard */}
      <div className="p-3 border-t border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-500 hover:text-gray-700"
          onClick={() => navigate('/dashboard')}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Button>
      </div>
    </aside>
  );
}
