import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  BookOpen,
  ClipboardCheck,
  Lock,
  FileText,
  Play,
  Headphones,
  Save,
  X,
  ListTree,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  generateTopicContent,
  toggleTopicCompletion,
  fetchResources,
  selectResources,
  selectActiveResourceView,
  setActiveResourceView,
  createNote,
} from '../../store/slices/syllabusSlice';
import { Button } from '../components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { Separator } from '../components/ui/separator';
import { cn } from '../components/ui/utils';
import { TopicQuizOverlay } from '../components/TopicQuizOverlay';
import { CourseStructureDialog } from '../components/CourseStructureDialog';

export default function TopicPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { enrollmentId, moduleIndex, topicIndex } = useParams();
  const eId = enrollmentId ? parseInt(enrollmentId) : null;
  const mIdx = moduleIndex ? parseInt(moduleIndex) : 0;
  const tIdx = topicIndex ? parseInt(topicIndex) : 0;
  const topicKey = `${eId}-${mIdx}-${tIdx}`;

  const {
    syllabus,
    courseName,
    generatedContent,
    contentLoading,
    topicCompletion,
    quizResults,
  } = useAppSelector((state) => state.syllabus);

  const content = generatedContent[topicKey];
  const isLoading = !!contentLoading[topicKey];
  const isComplete = !!topicCompletion[topicKey];

  const currentModule = syllabus?.modules[mIdx];
  const currentTopic = currentModule?.topics[tIdx];

  // ─── Resources & active view from Redux ────────────────────────────────────

  const resources = useAppSelector((state) =>
    content?.lessonId ? selectResources(state, content.lessonId) : []
  );
  const activeView = useAppSelector((state) =>
    selectActiveResourceView(state, mIdx, tIdx)
  );

  // Fetch resources when content is loaded
  useEffect(() => {
    if (content?.lessonId && resources.length === 0) {
      dispatch(fetchResources(content.lessonId));
    }
  }, [content?.lessonId, dispatch, resources.length]);

  // Find the active resource data when user has selected one
  const activeResource = activeView?.resourceId
    ? resources.find((r) => r.id === activeView.resourceId)
    : null;

  // ─── Create Note state ─────────────────────────────────────────────────────

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);

  const handleSaveNote = async () => {
    if (!content?.lessonId || !noteTitle.trim() || !noteContent.trim()) return;
    setNoteSaving(true);
    await dispatch(
      createNote({
        lessonId: content.lessonId,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        moduleIndex: mIdx,
        topicIndex: tIdx,
      })
    );
    setNoteSaving(false);
    setNoteTitle('');
    setNoteContent('');
    // Switch to text view after saving
    dispatch(setActiveResourceView({ moduleIndex: mIdx, topicIndex: tIdx, view: null }));
  };

  // ─── Module unlock check ──────────────────────────────────────────────────

  const isModuleUnlocked = useCallback(
    (moduleIdx: number): boolean => {
      if (moduleIdx === 0) return true;
      if (!syllabus) return false;
      const prevMod = syllabus.modules[moduleIdx - 1];
      if (!prevMod) return false;
      for (let t = 0; t < prevMod.topics.length; t++) {
        const key = `${eId}-${moduleIdx - 1}-${t}`;
        if (!topicCompletion[key]) return false;
        const result = quizResults[key];
        if (!result || result.scorePercent < 80) return false;
      }
      return true;
    },
    [syllabus, topicCompletion, quizResults, eId]
  );

  // Quiz overlay state
  const [quizOverlayOpen, setQuizOverlayOpen] = useState(false);

  // ─── Navigation helpers ────────────────────────────────────────────────────

  const getPrevTopic = useCallback((): {
    mIdx: number;
    tIdx: number;
  } | null => {
    if (!syllabus) return null;
    if (tIdx > 0) return { mIdx, tIdx: tIdx - 1 };
    if (mIdx > 0) {
      const prevModule = syllabus.modules[mIdx - 1];
      return { mIdx: mIdx - 1, tIdx: prevModule.topics.length - 1 };
    }
    return null;
  }, [syllabus, mIdx, tIdx]);

  const getNextTopic = useCallback((): {
    mIdx: number;
    tIdx: number;
  } | null => {
    if (!syllabus) return null;
    // Next topic within same module
    if (currentModule && tIdx < currentModule.topics.length - 1) {
      return { mIdx, tIdx: tIdx + 1 };
    }
    // Next module — only if unlocked
    if (mIdx < syllabus.modules.length - 1 && isModuleUnlocked(mIdx + 1)) {
      return { mIdx: mIdx + 1, tIdx: 0 };
    }
    return null;
  }, [syllabus, currentModule, mIdx, tIdx, isModuleUnlocked]);

  // Whether the next module exists but is locked
  const nextModuleLocked = (() => {
    if (!syllabus || !currentModule) return false;
    // If we're on the last topic of this module and the next module exists but is locked
    if (tIdx === currentModule.topics.length - 1 && mIdx < syllabus.modules.length - 1) {
      return !isModuleUnlocked(mIdx + 1);
    }
    return false;
  })();

  const prev = getPrevTopic();
  const next = getNextTopic();

  const navigateToTopic = (target: { mIdx: number; tIdx: number }) => {
    navigate(
      `/course/${enrollmentId}/module/${target.mIdx}/topic/${target.tIdx}`
    );
  };

  // ─── Auto-generate content on first visit ─────────────────────────────────

  const handleGenerate = useCallback(() => {
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
  }, [dispatch, eId, currentModule, currentTopic, mIdx, tIdx]);

  // ─── Auto-generate content on first visit ─────────────────────────────────

  useEffect(() => {
    // Auto-generate content when the topic page loads if content doesn't exist
    if (!content && !isLoading && currentTopic && eId && currentModule) {
      console.log(`📚 Auto-generating content for: ${currentTopic.topic_name}`);
      handleGenerate();
    }
  }, [content, isLoading, currentTopic, eId, currentModule, handleGenerate]);

  // ─── Auto-generate video on page load (DISABLED) ──────────────────────────
  // Video generation now only happens when user clicks "Generate Video" button

  // useEffect(() => {
  //   console.log('📹 Video auto-generation check:', {
  //     hasCurrentTopic: !!currentTopic,
  //     isVideoLoading,
  //     videoTask,
  //     hasContent: !!content,
  //   });
    
  //   // Don't generate if:
  //   // - No topic info available
  //   // - Video is already generating
  //   // - Video task exists and is not failed
  //   if (!currentTopic || isVideoLoading) {
  //     console.log('⏭️ Skipping video generation:', {
  //       noTopic: !currentTopic,
  //       isLoading: isVideoLoading,
  //     });
  //     return;
  //   }
    
  //   const shouldGenerateVideo = 
  //     !videoTask || // No video task exists yet
  //     videoTask.status === 'failed'; // Or previous attempt failed
    
  //   console.log('🎬 Should generate video?', shouldGenerateVideo);
    
  //   if (shouldGenerateVideo) {
  //     // Use topic description for video generation
  //     // Video can be generated even without content
  //     const videoSource = content?.content || currentTopic.description;
      
  //     if (videoSource) {
  //       console.log(`🎬 Auto-generating video for: ${currentTopic.topic_name}`);
  //       dispatch(
  //         generateVideo({
  //           topicName: currentTopic.topic_name,
  //           lessonId: content?.lessonId,
  //           moduleIndex: mIdx,
  //           topicIndex: tIdx,
  //         })
  //       );
  //     } else {
  //       console.log('❌ No video source (content or description)');
  //     }
  //   }
  // }, [
  //   currentTopic,
  //   videoTask,
  //   isVideoLoading,
  //   content,
  //   dispatch,
  //   mIdx,
  //   tIdx,
  // ]);

  // ─── Toggle completion ─────────────────────────────────────────────────────

  const handleToggleCompletion = () => {
    if (isComplete) {
      // If already complete, allow toggling off
      dispatch(toggleTopicCompletion({ moduleIndex: mIdx, topicIndex: tIdx }));
    } else {
      // If not complete, open quiz overlay for knowledge check
      setQuizOverlayOpen(true);
    }
  };

  const handleQuizComplete = () => {
    // Called after quiz is passed (or user chooses to continue)
    // Navigation to next topic is handled by the next button
  };

  // ─── Scroll to top & reset view on topic change ─────────────────────────────

  useEffect(() => {
    window.scrollTo?.(0, 0);
    // Reset active resource view when navigating to a new topic
    dispatch(setActiveResourceView({ moduleIndex: mIdx, topicIndex: tIdx, view: null }));
    setNoteTitle('');
    setNoteContent('');
  }, [mIdx, tIdx, dispatch]);

  // ─── Redirect if module is locked ──────────────────────────────────────────

  useEffect(() => {
    if (syllabus && !isModuleUnlocked(mIdx)) {
      navigate(`/course/${enrollmentId}`, { replace: true });
    }
  }, [syllabus, mIdx, enrollmentId, navigate, isModuleUnlocked]);

  if (!syllabus || !currentModule || !currentTopic) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Topic not found</p>
      </div>
    );
  }

  // ─── Render Markdown content as HTML ───────────────────────────────────────

  const renderContent = (markdown: string) => {
    // Simple markdown → HTML conversion for common patterns
    let html = markdown
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h1>')
      // Bold and Italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
        return `<pre class="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto my-4 text-sm"><code>${code
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</code></pre>`;
      })
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm">$1</code>')
      // Paragraphs — wrap non-tagged lines
      .replace(/^(?!<[h123pre])(.*\S.*)$/gm, '<p class="text-gray-700 leading-relaxed mb-4">$1</p>');

    return html;
  };

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="flex items-center justify-between mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/course/${enrollmentId}`}>{courseName}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/course/${enrollmentId}/module/${mIdx}/topic/0`}>
                  {currentModule.module_name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentTopic.topic_name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        {syllabus && eId && (
          <Button
            onClick={() => setStructureDialogOpen(true)}
            variant="outline"
            size="sm"
          >
            <ListTree className="w-4 h-4 mr-2" />
            Structure
          </Button>
        )}
      </div>

      {/* Topic Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {currentTopic.topic_name}
        </h1>
        <p className="text-gray-500">{currentTopic.description}</p>
      </div>

      {/* Content Area — switches between text, video, audio, notes based on activeView */}
      <div className="bg-white rounded-2xl border border-gray-200 min-h-[400px]">
        {isLoading ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-500 text-sm">
              Generating personalized content...
            </p>
            <p className="text-gray-400 text-xs mt-1">
              This may take a moment
            </p>
          </div>
        ) : content ? (
          <>
            {/* View-type tabs (visible when resources exist) */}
            {resources.length > 0 && (
              <div className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-gray-100 overflow-x-auto">
                {/* Default text view */}
                <button
                  onClick={() =>
                    dispatch(setActiveResourceView({ moduleIndex: mIdx, topicIndex: tIdx, view: null }))
                  }
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                    !activeView
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-50'
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Reading
                </button>

                {/* Video resources */}
                {resources
                  .filter((r) => r.resource_type === 'video')
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() =>
                        dispatch(
                          setActiveResourceView({
                            moduleIndex: mIdx,
                            topicIndex: tIdx,
                            view: { type: 'video', resourceId: r.id },
                          })
                        )
                      }
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                        activeView?.type === 'video' && activeView.resourceId === r.id
                          ? 'bg-purple-50 text-purple-700'
                          : 'text-gray-500 hover:bg-gray-50'
                      )}
                    >
                      <Play className="w-3.5 h-3.5" />
                      {r.title.length > 25 ? r.title.slice(0, 25) + '...' : r.title}
                    </button>
                  ))}

                {/* Audio resources */}
                {resources
                  .filter((r) => r.resource_type === 'audio')
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() =>
                        dispatch(
                          setActiveResourceView({
                            moduleIndex: mIdx,
                            topicIndex: tIdx,
                            view: { type: 'audio', resourceId: r.id },
                          })
                        )
                      }
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                        activeView?.type === 'audio' && activeView.resourceId === r.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-500 hover:bg-gray-50'
                      )}
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      {r.title.length > 25 ? r.title.slice(0, 25) + '...' : r.title}
                    </button>
                  ))}

                {/* Extra note resources (user-created) */}
                {/* Notes resources (both AI-generated and user-created) */}
                {resources
                  .filter((r) => r.resource_type === 'notes')
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() =>
                        dispatch(
                          setActiveResourceView({
                            moduleIndex: mIdx,
                            topicIndex: tIdx,
                            view: { type: 'notes', resourceId: r.id },
                          })
                        )
                      }
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                        activeView?.type === 'notes' && activeView.resourceId === r.id
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-gray-500 hover:bg-gray-50'
                      )}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {r.title.length > 20 ? r.title.slice(0, 20) + '...' : r.title}
                    </button>
                  ))}
              </div>
            )}

            {/* ── Render the active view ─────────────────────────────── */}

            {/* Create Note Form */}
            {activeView?.type === 'create-note' ? (
              <div className="p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-500" />
                    Create New Note
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      dispatch(
                        setActiveResourceView({ moduleIndex: mIdx, topicIndex: tIdx, view: null })
                      )
                    }
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <input
                  type="text"
                  placeholder="Note title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
                <textarea
                  placeholder="Write your note in Markdown..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={14}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-y font-mono"
                />
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveNote}
                    disabled={noteSaving || !noteTitle.trim() || !noteContent.trim()}
                    className="gap-2"
                  >
                    {noteSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Note
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      dispatch(
                        setActiveResourceView({ moduleIndex: mIdx, topicIndex: tIdx, view: null })
                      )
                    }
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : activeView?.type === 'video' && activeResource ? (
              /* ── Video player ──────────────────────────────────────── */
              <div className="p-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-purple-500" />
                  {activeResource.title}
                </h2>
                <video
                  controls
                  autoPlay
                  className="w-full rounded-xl shadow-lg"
                  src={activeResource.file_url || activeResource.file}
                >
                  Your browser does not support video playback.
                </video>
                {activeResource.duration_seconds && (
                  <p className="text-xs text-gray-400 mt-2">
                    Duration: {Math.floor(activeResource.duration_seconds / 60)}m{' '}
                    {activeResource.duration_seconds % 60}s
                  </p>
                )}
              </div>
            ) : activeView?.type === 'audio' && activeResource ? (
              /* ── Audio player ──────────────────────────────────────── */
              <div className="p-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Headphones className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    {activeResource.title}
                  </h2>
                  {activeResource.content_json?.person1 &&
                    activeResource.content_json?.person2 && (
                      <p className="text-sm text-gray-500 mb-4">
                        {activeResource.content_json.person1} &{' '}
                        {activeResource.content_json.person2}
                      </p>
                    )}
                  <audio
                    controls
                    autoPlay
                    className="w-full max-w-lg mx-auto"
                    src={activeResource.file_url || activeResource.file}
                  >
                    Your browser does not support the audio element.
                  </audio>
                  {activeResource.content_json?.instruction && (
                    <p className="text-xs text-gray-400 mt-4">
                      Focus: {activeResource.content_json.instruction}
                    </p>
                  )}
                </div>
              </div>
            ) : activeView?.type === 'notes' && activeResource ? (
              /* ── Note resource view ────────────────────────────────── */
              <div className="p-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  {activeResource.title}
                </h2>
                <article
                  className="prose prose-gray max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: renderContent(activeResource.content_text || ''),
                  }}
                />
              </div>
            ) : (
              /* ── Default: text reading view ────────────────────────── */
              <div className="p-8">
                <article
                  className="prose prose-gray max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: renderContent(content.content),
                  }}
                />
              </div>
            )}
          </>
        ) : (
          /* Generate CTA */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Ready to learn?
            </h2>
            <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
              Generate AI-powered content personalized to your learning level
              and style for &quot;{currentTopic.topic_name}&quot;.
            </p>
            <Button onClick={handleGenerate} size="lg">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Content
            </Button>
          </div>
        )}
      </div>

      {/* Completion & Navigation */}
      <div className="mt-6">
        <Separator className="mb-6" />

        <div className="flex items-center justify-between">
          {/* Previous */}
          <div>
            {prev ? (
              <Button
                variant="outline"
                onClick={() => navigateToTopic(prev)}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Topic
              </Button>
            ) : (
              <div /> // spacer
            )}
          </div>

          {/* Mark Complete */}
          {content && (
            <Button
              variant={isComplete ? 'outline' : 'default'}
              onClick={handleToggleCompletion}
              className={cn(
                'gap-2',
                isComplete &&
                  'border-green-300 text-green-700 hover:bg-green-50'
              )}
            >
              {isComplete ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Completed
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4" />
                  Take Quiz & Complete
                </>
              )}
            </Button>
          )}

          {/* Next */}
          <div>
            {next ? (
              <Button onClick={() => navigateToTopic(next)} className="gap-2">
                Next Topic
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : nextModuleLocked ? (
              <div className="flex flex-col items-end gap-1">
                <Button disabled className="gap-2 opacity-60 cursor-not-allowed">
                  <Lock className="w-4 h-4" />
                  Next Module Locked
                </Button>
                <p className="text-xs text-gray-400">
                  Score 80%+ on all topics to unlock
                </p>
              </div>
            ) : (
              <Button
                onClick={() => navigate(`/course/${enrollmentId}`)}
                className="gap-2"
              >
                Back to Overview
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quiz Overlay — triggered when user clicks "Take Quiz & Complete" */}
      {eId && content && (
        <TopicQuizOverlay
          open={quizOverlayOpen}
          onOpenChange={setQuizOverlayOpen}
          enrollmentId={eId}
          moduleIndex={mIdx}
          topicIndex={tIdx}
          onComplete={handleQuizComplete}
        />
      )}

      {/* Course Structure Dialog */}
      {syllabus && eId && (
        <CourseStructureDialog
          open={structureDialogOpen}
          onOpenChange={setStructureDialogOpen}
          syllabus={syllabus}
          courseName={courseName}
          enrollmentId={eId}
          topicCompletion={topicCompletion}
          onNavigateToTopic={(moduleIndex, topicIndex) => {
            navigate(`/course/${enrollmentId}/module/${moduleIndex}/topic/${topicIndex}`);
          }}
        />
      )}
    </div>
  );
}
