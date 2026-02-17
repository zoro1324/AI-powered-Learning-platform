import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  generateTopicQuiz,
  evaluateTopicQuiz,
  generateRemediationContent,
  markTopicComplete,
} from '../../store/slices/syllabusSlice';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';

interface TopicQuizOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: number;
  moduleIndex: number;
  topicIndex: number;
  onComplete: () => void; // called when quiz is passed or user proceeds
}

type QuizStep = 'loading' | 'quiz' | 'evaluating' | 'results';

export function TopicQuizOverlay({
  open,
  onOpenChange,
  enrollmentId,
  moduleIndex,
  topicIndex,
  onComplete,
}: TopicQuizOverlayProps) {
  const dispatch = useAppDispatch();
  const topicKey = `${moduleIndex}-${topicIndex}`;

  const {
    syllabus,
    generatedContent,
    generatedQuizzes,
    quizResults,
    quizLoading,
    quizEvaluating,
    remediationLoading,
  } = useAppSelector((state) => state.syllabus);

  const content = generatedContent[topicKey];
  const quiz = generatedQuizzes[topicKey];
  const quizResult = quizResults[topicKey];
  const isQuizLoading = !!quizLoading[topicKey];
  const isQuizEvaluating = !!quizEvaluating[topicKey];
  const isRemediationLoading = !!remediationLoading[topicKey];

  const currentModule = syllabus?.modules[moduleIndex];
  const currentTopic = currentModule?.topics[topicIndex];

  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [step, setStep] = useState<QuizStep>('loading');
  const [remediationTriggered, setRemediationTriggered] = useState(false);

  // Determine step based on state
  useEffect(() => {
    if (isQuizLoading) {
      setStep('loading');
    } else if (isQuizEvaluating) {
      setStep('evaluating');
    } else if (quizResult) {
      setStep('results');
    } else if (quiz) {
      setStep('quiz');
    } else {
      setStep('loading');
    }
  }, [isQuizLoading, isQuizEvaluating, quizResult, quiz]);

  // Auto-generate quiz when overlay opens
  useEffect(() => {
    if (open && !quiz && !isQuizLoading && content && currentTopic) {
      dispatch(
        generateTopicQuiz({
          lessonId: content.lessonId,
          topicName: currentTopic.topic_name,
          moduleIndex,
          topicIndex,
        })
      );
    }
  }, [open, quiz, isQuizLoading, content, currentTopic, dispatch, moduleIndex, topicIndex]);

  // Reset answers when quiz changes
  useEffect(() => {
    setQuizAnswers({});
    setRemediationTriggered(false);
  }, [topicKey]);

  const handleSubmitQuiz = useCallback(() => {
    if (!currentModule || !quiz) return;
    const answers = quiz.questions.map((_, i) => quizAnswers[i] || '');
    const questionIds = quiz.questions.map((q) => q.id!);
    dispatch(
      evaluateTopicQuiz({
        enrollmentId,
        moduleId: currentModule.order,
        questionIds,
        answers,
        moduleIndex,
        topicIndex,
      })
    );
  }, [dispatch, enrollmentId, currentModule, quiz, quizAnswers, moduleIndex, topicIndex]);

  const handleGenerateRemediation = useCallback(() => {
    if (!content || !quizResult || !currentTopic || remediationTriggered) return;
    setRemediationTriggered(true);
    dispatch(
      generateRemediationContent({
        enrollmentId,
        lessonId: content.lessonId,
        topicName: currentTopic.topic_name,
        weakAreas: quizResult.weakAreas,
        moduleIndex,
        topicIndex,
      })
    );
  }, [dispatch, enrollmentId, content, quizResult, currentTopic, moduleIndex, topicIndex, remediationTriggered]);

  const handleMarkComplete = useCallback(() => {
    dispatch(markTopicComplete({ moduleIndex, topicIndex }));
    onOpenChange(false);
    onComplete();
  }, [dispatch, moduleIndex, topicIndex, onOpenChange, onComplete]);

  const passed = quizResult && quizResult.scorePercent >= 80;
  const failed = quizResult && quizResult.scorePercent < 80;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            Knowledge Check
          </DialogTitle>
          <DialogDescription>
            {currentTopic?.topic_name} — Let's test your understanding before moving on
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-500 text-sm">
              Generating quiz questions from your lesson...
            </p>
            <p className="text-gray-400 text-xs mt-1">This may take a moment</p>
          </div>
        )}

        {/* Quiz questions */}
        {step === 'quiz' && quiz && (
          <div className="space-y-6 py-2">
            <div className="bg-blue-50 text-blue-700 rounded-lg px-4 py-2 text-sm">
              Answer all {quiz.questions.length} questions to check your understanding
            </div>
            {quiz.questions.map((q, qIdx) => (
              <div key={qIdx} className="space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  {qIdx + 1}. {q.question}
                </p>
                <div className="space-y-1.5">
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
                        'w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border',
                        quizAnswers[qIdx] === option
                          ? 'bg-blue-50 border-blue-300 text-blue-800 font-medium'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Evaluating state */}
        {step === 'evaluating' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-4" />
            <p className="text-gray-500 text-sm">Evaluating your answers...</p>
          </div>
        )}

        {/* Results */}
        {step === 'results' && quizResult && (
          <div className="space-y-4 py-2">
            {/* Score display */}
            <div
              className={cn(
                'rounded-xl p-6 text-center',
                passed ? 'bg-green-50' : 'bg-amber-50'
              )}
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                {passed ? (
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                )}
                <span className="text-3xl font-bold text-gray-900">
                  {quizResult.scorePercent}%
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {quizResult.correctCount} out of {quizResult.totalQuestions} correct
              </p>
              <p className={cn('text-sm font-medium mt-2', passed ? 'text-green-600' : 'text-amber-600')}>
                {passed
                  ? 'Great job! You scored 80%+ and can proceed to the next topic.'
                  : 'You need 80% to unlock the next module. Review the concepts and try again.'}
              </p>
            </div>

            {/* Weak areas */}
            {failed && quizResult.weakAreas.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <p className="text-sm font-medium text-gray-700">
                    Areas that need review:
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quizResult.weakAreas.map((area, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-red-50 text-red-700 text-xs"
                    >
                      {area.length > 80 ? area.slice(0, 80) + '...' : area}
                    </Badge>
                  ))}
                </div>

                {/* Generate remediation button */}
                {!remediationTriggered && (
                  <Button
                    onClick={handleGenerateRemediation}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Review Notes for Weak Areas
                  </Button>
                )}
                {isRemediationLoading && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    <span className="text-sm text-gray-500">
                      Generating focused review notes...
                    </span>
                  </div>
                )}
                {remediationTriggered && !isRemediationLoading && (
                  <div className="bg-green-50 rounded-lg px-4 py-2 text-sm text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Review notes have been added below your lesson content as expandable dropdowns.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === 'quiz' && quiz && (
            <Button
              onClick={handleSubmitQuiz}
              disabled={
                Object.keys(quizAnswers).length < quiz.questions.length
              }
              className="w-full sm:w-auto"
            >
              Submit Answers
            </Button>
          )}
          {step === 'results' && passed && (
            <Button
              onClick={handleMarkComplete}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark as Complete & Continue
            </Button>
          )}
          {step === 'results' && failed && (
            <div className="flex gap-2 w-full sm:w-auto">
              {remediationTriggered && !isRemediationLoading && (
                <Button
                  onClick={handleMarkComplete}
                  variant="outline"
                >
                  Continue Anyway
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
              <Button
                onClick={() => onOpenChange(false)}
                variant="secondary"
              >
                Review Content
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
