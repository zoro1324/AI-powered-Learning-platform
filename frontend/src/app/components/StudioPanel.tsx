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
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Wrench,
  Plus,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  generateTopicContent,
  generateTopicQuiz,
  evaluateTopicQuiz,
  generateVideo,
  pollVideoStatus,
  fetchResources,
  selectResources,
  setActiveResourceView,
} from '../../store/slices/syllabusSlice';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
  const topicKey = `${mIdx}-${tIdx}`;
  const isTopicView = mIdx >= 0 && tIdx >= 0;

  const {
    syllabus,
    generatedContent,
    generatedQuizzes,
    quizResults,
    videoTasks,
    contentLoading,
    quizLoading,
    quizEvaluating,
    videoLoading,
  } = useAppSelector((state) => state.syllabus);

  const content = generatedContent[topicKey];
  const quiz = generatedQuizzes[topicKey];
  const quizResult = quizResults[topicKey];
  const videoTask = videoTasks[topicKey];
  const isContentLoading = !!contentLoading[topicKey];
  const isQuizLoading = !!quizLoading[topicKey];
  const isQuizEvaluating = !!quizEvaluating[topicKey];
  const isVideoLoading = !!videoLoading[topicKey];

  // Get resources from database
  const resources = useAppSelector((state) =>
    content?.lessonId ? selectResources(state, content.lessonId) : []
  );

  // Quiz answer state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
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
        moduleId: currentModule.order,
        topicName: currentTopic.topic_name,
        moduleIndex: mIdx,
        topicIndex: tIdx,
      })
    );
    setExpandedTool('notes');
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
    setExpandedTool('quiz');
  }, [dispatch, content, currentTopic, mIdx, tIdx]);

  const handleSubmitQuiz = useCallback(() => {
    if (!eId || !currentModule || !quiz) return;
    const answers = quiz.questions.map((_, i) => quizAnswers[i] || '');
    dispatch(
      evaluateTopicQuiz({
        enrollmentId: eId,
        moduleId: currentModule.order,
        questions: quiz.questions,
        answers,
        moduleIndex: mIdx,
        topicIndex: tIdx,
      })
    );
  }, [dispatch, eId, currentModule, quiz, quizAnswers, mIdx, tIdx]);

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
    setExpandedTool('video');
  }, [dispatch, currentTopic, content, mIdx, tIdx]);

  const handleGeneratePodcast = useCallback(() => {
    if (!content) return;
    setPodcastDialogOpen(true);
    setExpandedTool('podcast');
  }, [content]);

  // Reset quiz answers and podcast when topic changes
  useEffect(() => {
    setQuizAnswers({});
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
    id,
    icon: Icon,
    label,
    bgColor,
    hasData,
    isLoading,
    onGenerate,
    disabled,
    children,
  }: {
    id: string;
    icon: React.ElementType;
    label: string;
    bgColor: string;
    hasData: boolean;
    isLoading: boolean;
    onGenerate: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => {
    const isExpanded = expandedTool === id;

    return (
      <div className="space-y-2">
        <button
          onClick={() => setExpandedTool(isExpanded ? null : id)}
          className={cn(
            'w-full rounded-xl p-3 flex items-center gap-3 transition-all text-left',
            bgColor,
            'hover:opacity-90'
          )}
        >
          <div className="w-9 h-9 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{label}</p>
            {hasData && (
              <p className="text-[10px] text-white/60">Generated</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasData && (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-white/50" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/50" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="bg-gray-800 rounded-xl p-3 space-y-3">
            {!hasData && !isLoading && !disabled && (
              <Button
                size="sm"
                onClick={onGenerate}
                className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate {label}
              </Button>
            )}
            {!hasData && !isLoading && disabled && (
              <Button
                size="sm"
                disabled
                className="w-full bg-gray-700 text-gray-400 border-0 cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate {label}
              </Button>
            )}
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating...</span>
              </div>
            )}
            {hasData && children}
            {!hasData && !isLoading && children}
          </div>
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
                id="notes"
                icon={FileText}
                label="Notes"
                bgColor="bg-emerald-800/80"
                hasData={!!content}
                isLoading={isContentLoading}
                onGenerate={handleGenerateContent}
              >
                <div className="text-sm text-gray-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {content?.content.slice(0, 500)}
                  {content && content.content.length > 500 && '...'}
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {content?.generatedAt
                    ? new Date(content.generatedAt).toLocaleTimeString()
                    : ''}
                </p>
              </ToolCard>

              <ToolCard
                id="quiz"
                icon={ListChecks}
                label="Quiz"
                bgColor="bg-amber-800/80"
                hasData={!!quiz}
                isLoading={isQuizLoading}
                onGenerate={handleGenerateQuiz}
                disabled={!content}
              >
                {quiz && !quizResult && (
                  <div className="space-y-4">
                    {quiz.questions.map((q, qIdx) => (
                      <div key={qIdx} className="space-y-2">
                        <p className="text-sm text-white font-medium">
                          {qIdx + 1}. {q.question}
                        </p>
                        <div className="space-y-1">
                          {q.options.map((option, oIdx) => (
                            <button
                              key={oIdx}
                              onClick={() =>
                                setQuizAnswers((prev) => ({
                                  ...prev,
                                  [qIdx]: option,
                                }))
                              }
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                                quizAnswers[qIdx] === option
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              )}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      onClick={handleSubmitQuiz}
                      disabled={
                        Object.keys(quizAnswers).length < quiz.questions.length ||
                        isQuizEvaluating
                      }
                      className="w-full"
                    >
                      {isQuizEvaluating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Evaluating...
                        </>
                      ) : (
                        'Submit Answers'
                      )}
                    </Button>
                  </div>
                )}
                {quizResult && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {quizResult.scorePercent >= 80 ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <span className="text-white font-semibold text-lg">
                        {quizResult.scorePercent}%
                      </span>
                      <span className="text-gray-400 text-sm">
                        ({quizResult.correctCount}/{quizResult.totalQuestions})
                      </span>
                    </div>
                    {quizResult.weakAreas.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">
                          Areas to improve:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {quizResult.weakAreas.map((area, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="bg-red-900/50 text-red-300 text-[10px]"
                            >
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ToolCard>

              <ToolCard
                id="video"
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
              >
                {(() => {
                  console.log('🎬 Video ToolCard render:', {
                    videoTask,
                    status: videoTask?.status,
                    videoUrl: videoTask?.videoUrl,
                    isCompleted: videoTask?.status === 'completed',
                    hasUrl: !!videoTask?.videoUrl,
                    resourcesCount: resources.filter(r => r.resource_type === 'video').length,
                  });
                  return null;
                })()}
                {/* Show videos from database resources */}
                {resources.filter(r => r.resource_type === 'video').map((resource) => (
                  <div key={resource.id} className="space-y-2">
                    <video
                      controls
                      className="w-full rounded-lg"
                      src={resource.file_url || resource.file}
                    >
                      Your browser does not support video playback.
                    </video>
                    <p className="text-xs text-gray-400">
                      {resource.title}
                    </p>
                  </div>
                ))}
                {/* Fallback to videoTask if no resources */}
                {resources.filter(r => r.resource_type === 'video').length === 0 && videoTask?.status === 'completed' && videoTask.videoUrl && (
                  <video
                    controls
                    className="w-full rounded-lg"
                    src={videoTask.videoUrl}
                  >
                    Your browser does not support video playback.
                  </video>
                )}
                {videoTask?.status === 'completed' && !videoTask.videoUrl && resources.filter(r => r.resource_type === 'video').length === 0 && (
                  <div className="text-yellow-400 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Video completed but URL not available yet
                  </div>
                )}
                {videoTask?.status === 'failed' && (
                  <div className="text-red-400 text-sm flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {videoTask.error || 'Video generation failed'}
                  </div>
                )}
              </ToolCard>

              <ToolCard
                id="podcast"
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
              >
                {!content ? (
                  <div className="text-sm text-gray-300 space-y-2">
                    <p className="text-yellow-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Generate Notes first
                    </p>
                    <p className="text-xs text-gray-400">
                      Content must be generated before creating a podcast
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Show podcasts from database resources */}
                    {resources.filter(r => r.resource_type === 'audio').map((resource) => (
                      <div key={resource.id} className="space-y-2">
                        <audio
                          controls
                          className="w-full"
                          src={resource.file_url || resource.file}
                        >
                          Your browser does not support the audio element.
                        </audio>
                        <div className="text-xs text-gray-400 space-y-1">
                          <p className="font-medium">{resource.title}</p>
                          {resource.content_json?.person1 && resource.content_json?.person2 && (
                            <p>Speakers: {resource.content_json.person1} & {resource.content_json.person2}</p>
                          )}
                          {resource.content_json?.instruction && (
                            <p>Focus: {resource.content_json.instruction}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Fallback to generatedPodcast if no resources */}
                    {resources.filter(r => r.resource_type === 'audio').length === 0 && generatedPodcast && (
                      <div className="space-y-2">
                        <audio
                          controls
                          className="w-full"
                          src={generatedPodcast.audioUrl.startsWith('http') 
                            ? generatedPodcast.audioUrl 
                            : `${(import.meta as any).env?.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${generatedPodcast.audioUrl}`}
                        >
                          Your browser does not support the audio element.
                        </audio>
                        <div className="text-xs text-gray-400 space-y-1">
                          <p>Speakers: {generatedPodcast.personas.person1} & {generatedPodcast.personas.person2}</p>
                          <p>Focus: {generatedPodcast.scenario}</p>
                        </div>
                      </div>
                    )}
                    {/* No podcasts available */}
                    {resources.filter(r => r.resource_type === 'audio').length === 0 && !generatedPodcast && (
                      <p className="text-sm text-gray-300">
                        Convert this topic into an engaging audio conversation
                      </p>
                    )}
                  </div>
                )}
              </ToolCard>

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

                  {/* User-created notes */}
                  {resources
                    .filter((r) => r.resource_type === 'notes' && !r.is_generated)
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
                    <button
                      onClick={() => setExpandedTool('quiz')}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                    >
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
                    </button>
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
                      <button
                        onClick={() => setExpandedTool('video')}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                      >
                        <Video className="w-4 h-4 text-purple-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300 truncate">
                            {currentTopic?.topic_name} - Video
                          </p>
                          <p className="text-[10px] text-gray-500">Generated</p>
                        </div>
                      </button>
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
                      <button
                        onClick={() => setExpandedTool('podcast')}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                      >
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
                      </button>
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
