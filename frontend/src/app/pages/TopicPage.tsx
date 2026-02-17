import { useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  generateTopicContent,
  toggleTopicCompletion,
  generateVideo,
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

export default function TopicPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { enrollmentId, moduleIndex, topicIndex } = useParams();
  const eId = enrollmentId ? parseInt(enrollmentId) : null;
  const mIdx = moduleIndex ? parseInt(moduleIndex) : 0;
  const tIdx = topicIndex ? parseInt(topicIndex) : 0;
  const topicKey = `${mIdx}-${tIdx}`;

  const {
    syllabus,
    courseName,
    generatedContent,
    contentLoading,
    topicCompletion,
    videoTasks,
    videoLoading,
  } = useAppSelector((state) => state.syllabus);

  const content = generatedContent[topicKey];
  const isLoading = !!contentLoading[topicKey];
  const isComplete = !!topicCompletion[topicKey];
  const videoTask = videoTasks[topicKey];
  const isVideoLoading = !!videoLoading[topicKey];

  const currentModule = syllabus?.modules[mIdx];
  const currentTopic = currentModule?.topics[tIdx];

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
    if (currentModule && tIdx < currentModule.topics.length - 1) {
      return { mIdx, tIdx: tIdx + 1 };
    }
    if (mIdx < syllabus.modules.length - 1) {
      return { mIdx: mIdx + 1, tIdx: 0 };
    }
    return null;
  }, [syllabus, currentModule, mIdx, tIdx]);

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
    dispatch(toggleTopicCompletion({ moduleIndex: mIdx, topicIndex: tIdx }));
  };

  // ─── Scroll to top on topic change ─────────────────────────────────────────

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [mIdx, tIdx]);

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
    <div className="max-w-4xl mx-auto px-6 py-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
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

      {/* Topic Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {currentTopic.topic_name}
        </h1>
        <p className="text-gray-500">{currentTopic.description}</p>
      </div>

      {/* Content Area */}
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
          /* Rendered content */
          <div className="p-8">
            <article
              className="prose prose-gray max-w-none"
              dangerouslySetInnerHTML={{
                __html: renderContent(content.content),
              }}
            />
          </div>
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
              and style for "{currentTopic.topic_name}".
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
                  <Circle className="w-4 h-4" />
                  Mark as Complete
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
    </div>
  );
}
