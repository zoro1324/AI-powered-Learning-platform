import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import {
  FileText,
  ListChecks,
  Video,
  Headphones,
  Sparkles,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
  MessageSquare,
  Wrench,
  Plus,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  generateTopicContent,
  generateTopicQuiz,
  generateVideo,
  pollVideoStatus,
  fetchResources,
  selectResources,
  setActiveResourceView,
} from '../../store/slices/syllabusSlice';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';
import { PodcastDialog } from './ui/podcast-dialog';
import { ChatPanel } from './ChatPanel';

interface StudioPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function StudioPanel({ collapsed, onToggle }: StudioPanelProps) {
  const dispatch = useAppDispatch();
  const { enrollmentId, moduleIndex, topicIndex } = useParams();
  const eId = enrollmentId ? parseInt(enrollmentId) : null;
  const mIdx = moduleIndex ? parseInt(moduleIndex) : -1;
  const tIdx = topicIndex ? parseInt(topicIndex) : -1;
  const topicKey = `${eId}-${mIdx}-${tIdx}`;
  const isTopicView = mIdx >= 0 && tIdx >= 0;

  const {
    syllabus,
    generatedContent,
    generatedQuizzes,
    videoTasks,
    contentLoading,
    quizLoading,
    videoLoading,
  } = useAppSelector((state) => state.syllabus);

  const content = generatedContent[topicKey];
  const quiz = generatedQuizzes[topicKey];
  const videoTask = videoTasks[topicKey];
  const isContentLoading = !!contentLoading[topicKey];
  const isQuizLoading = !!quizLoading[topicKey];
  const isVideoLoading = !!videoLoading[topicKey];

  // Get resources from database
  const resources = useAppSelector((state) =>
    content?.lessonId ? selectResources(state, content.lessonId) : []
  );

  // Quiz answer state
  const [podcastDialogOpen, setPodcastDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'studio' | 'chat'>('studio');
  const [generatedPodcast, setGeneratedPodcast] = useState<{
    audioUrl: string;
    personas: { person1: string; person2: string };
    scenario: string;
    generatedAt: string;
  } | null>(null);

  // Poll video status
  useEffect(() => {
    if (!videoTask || !isTopicView) return;
    if (videoTask.status === 'completed' || videoTask.status === 'failed') return;

    const interval = setInterval(() => {
      dispatch(
        pollVideoStatus({
          taskId: videoTask.taskId,
          moduleIndex: mIdx,
          topicIndex: tIdx,
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [videoTask, dispatch, mIdx, tIdx, isTopicView]);

  // Fetch resources when content is loaded
  useEffect(() => {
    if (content?.lessonId && resources.length === 0) {
      dispatch(fetchResources(content.lessonId));
    }
  }, [content?.lessonId, dispatch, resources.length]);

  // Refetch resources when video completes
  useEffect(() => {
    if (videoTask?.status === 'completed' && content?.lessonId) {
      // Wait a bit for the resource to be created in the database
      const timer = setTimeout(() => {
        dispatch(fetchResources(content.lessonId));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [videoTask?.status, content?.lessonId, dispatch]);

  const currentTopic = syllabus?.modules[mIdx]?.topics[tIdx];
  const currentModule = syllabus?.modules[mIdx];

  // ─── Handler Functions ─────────────────────────────────────────────────────

  const handleGenerateContent = useCallback(() => {
    if (!eId || !currentModule || !currentTopic) return;
    dispatch(
      generateTopicContent({
        enrollmentId: eId,
        moduleId: mIdx + 1,
        topicName: currentTopic.topic_name,
        moduleIndex: mIdx,
        topicIndex: tIdx,
      })
    );
  }, [dispatch, eId, currentModule, currentTopic, mIdx, tIdx]);

  const handleGenerateQuiz = useCallback(() => {
    if (!content || !currentTopic) return;
    dispatch(
      generateTopicQuiz({
        lessonId: content.lessonId,
        topicName: currentTopic.topic_name,
        moduleIndex: mIdx,
        topicIndex: tIdx,
      })
    );
  }, [dispatch, content, currentTopic, mIdx, tIdx]);

  const handleGenerateVideo = useCallback(() => {
    console.log('🎬 handleGenerateVideo called');
    console.log('📍 currentTopic:', currentTopic);
    console.log('📍 mIdx:', mIdx, 'tIdx:', tIdx);
    console.log('📍 content:', content);

    if (!currentTopic) {
      console.error('❌ currentTopic is undefined, cannot generate video');
      return;
    }

    console.log('✅ Dispatching generateVideo with:', {
      topicName: currentTopic.topic_name,
      lessonId: content?.lessonId,
      moduleIndex: mIdx,
      topicIndex: tIdx,
    });

    dispatch(
      generateVideo({
        topicName: currentTopic.topic_name,
        lessonId: content?.lessonId,
        moduleIndex: mIdx,
        topicIndex: tIdx,
      })
    );
  }, [dispatch, currentTopic, content, mIdx, tIdx]);

  const handleGeneratePodcast = useCallback(() => {
    if (!content) return;
    setPodcastDialogOpen(true);
  }, [content]);

  // Reset podcast when topic changes
  useEffect(() => {
    setGeneratedPodcast(null);
  }, [topicKey]);

  // ─── Collapsed state ──────────────────────────────────────────────────────

  if (collapsed) {
    return (
      <div className="w-12 bg-gray-900 border-l border-gray-700 flex flex-col items-center pt-4 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <PanelRightOpen className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  // ─── Tool card component ───────────────────────────────────────────────────

  const ToolCard = ({
    icon: Icon,
    label,
    bgColor,
    hasData,
    isLoading,
    onGenerate,
    disabled,
    children,
  }: {
    icon: React.ElementType;
    label: string;
    bgColor: string;
    hasData: boolean;
    isLoading: boolean;
    onGenerate: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => {
    return (
      <div className={cn('rounded-xl p-3 space-y-3', bgColor)}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{label}</p>
            {hasData && (
              <p className="text-[10px] text-white/60">Generated</p>
            )}
          </div>
          {hasData && (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          )}
        </div>

        {/* Content */}
        {hasData && (
          <div className="bg-black/20 rounded-lg p-3 space-y-3">
            {children}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-4 text-white/70">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generating...</span>
          </div>
        )}

        {/* Generate Button - Always show when not loading */}
        {!isLoading && !disabled && (
          <Button
            size="sm"
            onClick={onGenerate}
            className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {hasData ? `Generate New ${label}` : `Generate ${label}`}
          </Button>
        )}

        {!isLoading && disabled && (
          <Button
            size="sm"
            disabled
            className="w-full bg-black/20 text-white/40 border-0 cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate {label}
          </Button>
        )}
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <aside className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full shrink-0">
      {/* Header with Tab Toggle */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('studio')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                activeTab === 'studio'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              )}
            >
              <Wrench className="w-3.5 h-3.5" />
              Studio
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-gray-400 hover:text-white hover:bg-gray-800 h-7 w-7"
          >
            <PanelRightClose className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' ? (
        <ChatPanel
          context={content?.content || ''}
          topicName={currentTopic?.topic_name || ''}
          courseName={syllabus?.course_name || ''}
          hasContent={!!content}
        />
      ) : (
        /* Studio Tab */
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3">
            {!isTopicView ? (
              /* Course overview — no tools available */
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  Select a topic to use AI Studio tools
                </p>
              </div>
            ) : (
              <>
                {/* Current topic info */}
                <div className="bg-gray-800 rounded-xl p-3 mb-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                    Current Topic
                  </p>
                  <p className="text-sm text-white font-medium">
                    {currentTopic?.topic_name || 'Unknown Topic'}
                  </p>
                </div>

                {/* Tool Cards Grid */}
                <ToolCard
                  icon={FileText}
                  label="Notes"
                  bgColor="bg-emerald-800/80"
                  hasData={!!content}
                  isLoading={isContentLoading}
                  onGenerate={handleGenerateContent}
                />

                <ToolCard
                  icon={ListChecks}
                  label="Quiz"
                  bgColor="bg-amber-800/80"
                  hasData={!!quiz}
                  isLoading={isQuizLoading}
                  onGenerate={handleGenerateQuiz}
                  disabled={!content}
                />

                <ToolCard
                  icon={Video}
                  label="Video"
                  bgColor="bg-purple-800/80"
                  hasData={
                    videoTask?.status === 'completed' ||
                    resources.some(r => r.resource_type === 'video')
                  }
                  isLoading={
                    isVideoLoading ||
                    videoTask?.status === 'pending' ||
                    videoTask?.status === 'processing'
                  }
                  onGenerate={handleGenerateVideo}
                />

                <ToolCard
                  icon={Headphones}
                  label="Podcast"
                  bgColor="bg-blue-800/80"
                  hasData={
                    !!generatedPodcast ||
                    resources.some(r => r.resource_type === 'audio')
                  }
                  isLoading={false}
                  onGenerate={handleGeneratePodcast}
                  disabled={!content}
                />

                {/* Generated Content list */}
                {(content || quiz || videoTask || generatedPodcast || resources.length > 0) && (
                  <div className="pt-4 border-t border-gray-700 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Generated Resources
                      </p>
                      {/* Create Note button */}
                      {content && (
                        <button
                          onClick={() =>
                            dispatch(
                              setActiveResourceView({
                                moduleIndex: mIdx,
                                topicIndex: tIdx,
                                view: { type: 'create-note' },
                              })
                            )
                          }
                          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          New Note
                        </button>
                      )}
                    </div>

                    {/* Notes — click to switch center view to text reading */}
                    {content && (
                      <button
                        onClick={() =>
                          dispatch(
                            setActiveResourceView({
                              moduleIndex: mIdx,
                              topicIndex: tIdx,
                              view: null,
                            })
                          )
                        }
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                      >
                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300 truncate">
                            {currentTopic?.topic_name} - Notes
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {content.generatedAt
                              ? new Date(content.generatedAt).toLocaleDateString()
                              : ''}
                          </p>
                        </div>
                      </button>
                    )}

                    {/* All notes (AI-generated and user-created) */}
                    {resources
                      .filter((r) => r.resource_type === 'notes')
                      .map((resource) => (
                        <button
                          key={resource.id}
                          onClick={() =>
                            dispatch(
                              setActiveResourceView({
                                moduleIndex: mIdx,
                                topicIndex: tIdx,
                                view: { type: 'notes', resourceId: resource.id },
                              })
                            )
                          }
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                        >
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 truncate">
                              {resource.title}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {resource.created_at
                                ? new Date(resource.created_at).toLocaleDateString()
                                : ''}
                            </p>
                          </div>
                        </button>
                      ))}

                    {quiz && (
                      <div className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-800/50">
                        <ListChecks className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300 truncate">
                            {currentTopic?.topic_name} - Quiz
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {quiz.generatedAt
                              ? new Date(quiz.generatedAt).toLocaleDateString()
                              : ''}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Video resources — click to switch center to video player */}
                    {resources
                      .filter((r) => r.resource_type === 'video')
                      .map((resource) => (
                        <button
                          key={resource.id}
                          onClick={() =>
                            dispatch(
                              setActiveResourceView({
                                moduleIndex: mIdx,
                                topicIndex: tIdx,
                                view: { type: 'video', resourceId: resource.id },
                              })
                            )
                          }
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                        >
                          <Video className="w-4 h-4 text-purple-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 truncate">
                              {resource.title}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {resource.created_at
                                ? new Date(resource.created_at).toLocaleDateString()
                                : 'Generated'}
                            </p>
                          </div>
                        </button>
                      ))}
                    {/* Fallback to videoTask for in-progress videos */}
                    {videoTask?.status === 'completed' &&
                      resources.filter((r) => r.resource_type === 'video').length === 0 && (
                        <div className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-800/50">
                          <Video className="w-4 h-4 text-purple-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 truncate">
                              {currentTopic?.topic_name} - Video
                            </p>
                            <p className="text-[10px] text-gray-500">Generated</p>
                          </div>
                        </div>
                      )}

                    {/* Audio/Podcast resources — click to switch center to audio player */}
                    {resources
                      .filter((r) => r.resource_type === 'audio')
                      .map((resource) => (
                        <button
                          key={resource.id}
                          onClick={() =>
                            dispatch(
                              setActiveResourceView({
                                moduleIndex: mIdx,
                                topicIndex: tIdx,
                                view: { type: 'audio', resourceId: resource.id },
                              })
                            )
                          }
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                        >
                          <Headphones className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 truncate">
                              {resource.title}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {resource.created_at
                                ? new Date(resource.created_at).toLocaleDateString()
                                : 'Generated'}
                            </p>
                          </div>
                        </button>
                      ))}
                    {/* Fallback to generatedPodcast for session state */}
                    {generatedPodcast &&
                      resources.filter((r) => r.resource_type === 'audio').length === 0 && (
                        <div className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-800/50">
                          <Headphones className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 truncate">
                              {currentTopic?.topic_name} - Podcast
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {generatedPodcast.generatedAt
                                ? new Date(
                                  generatedPodcast.generatedAt
                                ).toLocaleDateString()
                                : 'Generated'}
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Podcast Dialog */}
      {content && currentTopic && (
        <PodcastDialog
          open={podcastDialogOpen}
          onOpenChange={setPodcastDialogOpen}
          content={content.content}
          topicName={currentTopic.topic_name}
          lessonId={content.lessonId}
          enrollmentId={eId ?? undefined}
          onPodcastGenerated={(data) => setGeneratedPodcast(data)}
          onComplete={() => {
            // Refetch resources after podcast generation
            if (content?.lessonId) {
              dispatch(fetchResources(content.lessonId));
            }
          }}
        />
      )}
    </aside>
  );
}
