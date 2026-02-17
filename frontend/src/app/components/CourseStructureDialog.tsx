import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { cn } from './ui/utils';
import { Syllabus } from '../../services/api';

interface CourseStructureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus: Syllabus;
  courseName: string;
  enrollmentId: number;
  topicCompletion: Record<string, boolean>;
  onNavigateToTopic?: (moduleIndex: number, topicIndex: number) => void;
}

export function CourseStructureDialog({
  open,
  onOpenChange,
  syllabus,
  courseName,
  enrollmentId,
  topicCompletion,
  onNavigateToTopic,
}: CourseStructureDialogProps) {
  const [expandedModules, setExpandedModules] = useState<Set<number>>(
    new Set([0]) // First module expanded by default
  );

  const toggleModule = (moduleIndex: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleIndex)) {
      newExpanded.delete(moduleIndex);
    } else {
      newExpanded.add(moduleIndex);
    }
    setExpandedModules(newExpanded);
  };

  const expandAll = () => {
    setExpandedModules(new Set(syllabus.modules.map((_, idx) => idx)));
  };

  const collapseAll = () => {
    setExpandedModules(new Set());
  };

  const isTopicComplete = (moduleIndex: number, topicIndex: number) => {
    return !!topicCompletion[`${enrollmentId}-${moduleIndex}-${topicIndex}`];
  };

  const getModuleCompletionCount = (moduleIndex: number) => {
    const module = syllabus.modules[moduleIndex];
    let count = 0;
    module.topics.forEach((_, topicIdx) => {
      if (isTopicComplete(moduleIndex, topicIdx)) count++;
    });
    return count;
  };

  const difficultyColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'advanced':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleNavigate = (moduleIndex: number, topicIndex: number) => {
    if (onNavigateToTopic) {
      onNavigateToTopic(moduleIndex, topicIndex);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{courseName}</DialogTitle>
              <DialogDescription className="text-base">
                Complete course structure with all modules and topics
              </DialogDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-4 pt-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <BookOpen className="w-4 h-4" />
              <span className="font-medium">{syllabus.total_modules} Modules</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <BookOpen className="w-4 h-4" />
              <span className="font-medium">
                {syllabus.modules.reduce((sum, m) => sum + m.topics.length, 0)} Topics
              </span>
            </div>
            <Badge className={cn('text-xs capitalize', difficultyColor(syllabus.knowledge_level))}>
              {syllabus.knowledge_level}
            </Badge>
          </div>

          <div className="flex gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              className="text-xs"
            >
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              className="text-xs"
            >
              Collapse All
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4 max-h-[calc(90vh-200px)]">
          <div className="space-y-4 pb-4">
            {syllabus.modules.map((module, moduleIndex) => {
              const isExpanded = expandedModules.has(moduleIndex);
              const completedCount = getModuleCompletionCount(moduleIndex);
              const totalTopics = module.topics.length;
              const progressPercent = totalTopics > 0 
                ? Math.round((completedCount / totalTopics) * 100) 
                : 0;

              return (
                <div
                  key={moduleIndex}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Module Header */}
                  <button
                    onClick={() => toggleModule(moduleIndex)}
                    className="w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">
                      {module.order}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-base">
                          {module.module_name}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className={cn('text-xs capitalize', difficultyColor(module.difficulty_level))}
                        >
                          {module.difficulty_level}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {module.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {totalTopics} topics
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          ~{module.estimated_duration_minutes || 60} min
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {completedCount}/{totalTopics} completed
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                          {...({ style: { width: `${progressPercent}%` }} as any)}
                        />
                      </div>
                    </div>

                    <div className="flex-shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Topics List */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      <div className="p-4 space-y-2">
                        {module.topics.map((topic, topicIndex) => {
                          const completed = isTopicComplete(moduleIndex, topicIndex);
                          
                          return (
                            <div
                              key={topicIndex}
                              className={cn(
                                'p-3 rounded-lg border transition-all',
                                completed 
                                  ? 'bg-green-50 border-green-200' 
                                  : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                  {completed ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-gray-500">
                                      Topic {topic.order}
                                    </span>
                                    {completed && (
                                      <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                                        Completed
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <h4 className="font-medium text-gray-900 text-sm mb-1">
                                    {topic.topic_name}
                                  </h4>
                                  
                                  <p className="text-xs text-gray-600 leading-relaxed">
                                    {topic.description}
                                  </p>

                                  {onNavigateToTopic && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleNavigate(moduleIndex, topicIndex)}
                                      className="mt-2 h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      Go to Topic →
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
