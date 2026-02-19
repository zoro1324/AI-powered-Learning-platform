import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Loader2, CheckCircle, Brain, Sparkles, Target } from 'lucide-react';
import { assessmentAPI, AssessmentQuestion, Syllabus } from '../../services/api';
import { useAppDispatch } from '../../store';
import { setSyllabusFromEvaluation } from '../../store/slices/syllabusSlice';

interface AssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: number;
  courseName: string;
  onEnrollmentComplete: (enrollmentId: number) => void;
}

type AssessmentStep = 'loading' | 'study-method' | 'questions' | 'submitting' | 'complete';
type StudyMethod = 'real_world' | 'theory_depth' | 'project_based' | 'custom';

export default function AssessmentDialog({
  open,
  onOpenChange,
  courseId,
  courseName,
  onEnrollmentComplete,
}: AssessmentDialogProps) {
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<AssessmentStep>('loading');
  const [studyMethod, setStudyMethod] = useState<StudyMethod>('real_world');
  const [customStudyMethod, setCustomStudyMethod] = useState<string>('');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});  // Changed to store indices
  const [evaluation, setEvaluation] = useState<any>(null);
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load initial assessment when dialog opens
  const loadAssessment = async () => {
    console.log('🔵 loadAssessment() called');
    console.log('🔵 courseId:', courseId, 'courseName:', courseName);
    try {
      setStep('loading');
      setError(null);
      console.log('🔵 About to call assessmentAPI.generateInitialAssessment...');
      const response = await assessmentAPI.generateInitialAssessment({
        course_id: courseId,
        course_name: courseName,
      });
      console.log('🔵 Assessment API response:', response);
      
      // Validate questions have options
      const validatedQuestions = (response.questions || []).map(q => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : []
      }));
      
      if (validatedQuestions.length === 0) {
        throw new Error('No valid questions received from API');
      }
      
      setQuestions(validatedQuestions);
      setStep('study-method');  // First show study method selection
    } catch (err: any) {
      console.error('🔴 Error loading assessment:', err);
      console.error('🔴 Error details:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to load assessment');
      setStep('study-method');
    }
  };

  // Automatically load assessment when dialog opens
  useEffect(() => {
    console.log('🟡 useEffect triggered - open prop changed to:', open);
    if (open) {
      console.log('🟡 Dialog is open, loading assessment...');
      loadAssessment();
    } else {
      // Dialog is closing - reset state
      console.log('🟡 Dialog is closing, resetting state...');
      setStep('loading');
      setStudyMethod('real_world');
      setCustomStudyMethod('');
      setQuestions([]);
      setAnswers({});
      setEvaluation(null);
      setSyllabus(null);
      setError(null);
    }
  }, [open]);

  // Handle dialog open state
  const handleOpenChange = (newOpen: boolean) => {
    console.log('🟢 handleOpenChange called with:', newOpen);
    onOpenChange(newOpen);
  };

  const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
    setAnswers({ ...answers, [questionIndex]: optionIndex });
  };

  const handleSubmit = async () => {
    try {
      setStep('submitting');
      setError(null);

      // Convert answers object to array of indices
      const answersArray = questions.map((_, index) => answers[index] ?? 3);  // Default to "I don't know" if not answered

      const response = await assessmentAPI.evaluateAssessment({
        course_id: courseId,
        course_name: courseName,
        questions: questions,
        answers: answersArray,
        study_method: studyMethod,
        custom_study_method: studyMethod === 'custom' ? customStudyMethod : '',
      });

      setEvaluation(response.assessment_result);
      setSyllabus(response.syllabus);
      setStep('complete');

      // Store syllabus in Redux for immediate use in CourseLayout
      if (response.syllabus) {
        dispatch(setSyllabusFromEvaluation({
          enrollmentId: response.enrollment_id,
          courseName: courseName,
          syllabus: response.syllabus,
        }));
      }

      // Notify parent component
      setTimeout(() => {
        onEnrollmentComplete(response.enrollment_id);
        handleOpenChange(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error submitting assessment:', err);
      setError(err.response?.data?.error || 'Failed to submit assessment');
      setStep('questions');
    }
  };

  const allQuestionsAnswered = questions.length > 0 && 
    questions.every((_, index) => answers[index] !== undefined);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        {step === 'loading' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Generating personalized assessment...</p>
          </div>
        )}

        {step === 'study-method' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Target className="w-6 h-6 text-blue-600" />
                Choose Your Learning Style
              </DialogTitle>
              <DialogDescription>
                Select how you'd like to approach learning{' '}
                <span className="font-semibold">{courseName}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6">
              <RadioGroup value={studyMethod} onValueChange={(value) => setStudyMethod(value as StudyMethod)}>
                <Card className={`cursor-pointer transition-all ${studyMethod === 'real_world' ? 'border-blue-500 border-2' : 'border'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="real_world" id="real_world" />
                      <div className="flex-1">
                        <Label htmlFor="real_world" className="cursor-pointer font-semibold text-base">
                          Real-World Examples
                        </Label>
                        <p className="text-sm text-gray-600 mt-1">
                          Learn through practical applications and real-world scenarios
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${studyMethod === 'theory_depth' ? 'border-blue-500 border-2' : 'border'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="theory_depth" id="theory_depth" />
                      <div className="flex-1">
                        <Label htmlFor="theory_depth" className="cursor-pointer font-semibold text-base">
                          Theory Depth
                        </Label>
                        <p className="text-sm text-gray-600 mt-1">
                          Deep dive into concepts, principles, and theoretical foundations
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${studyMethod === 'project_based' ? 'border-blue-500 border-2' : 'border'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="project_based" id="project_based" />
                      <div className="flex-1">
                        <Label htmlFor="project_based" className="cursor-pointer font-semibold text-base">
                          Project-Based Learning
                        </Label>
                        <p className="text-sm text-gray-600 mt-1">
                          Build hands-on projects while learning new concepts
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${studyMethod === 'custom' ? 'border-blue-500 border-2' : 'border'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="custom" id="custom" />
                      <div className="flex-1">
                        <Label htmlFor="custom" className="cursor-pointer font-semibold text-base">
                          Custom Approach
                        </Label>
                        <p className="text-sm text-gray-600 mt-1">
                          Describe your preferred learning style
                        </p>
                        {studyMethod === 'custom' && (
                          <Input
                            placeholder="e.g., Focus on accessibility and responsive design patterns"
                            className="mt-3"
                            value={customStudyMethod}
                            onChange={(e) => setCustomStudyMethod(e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </RadioGroup>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={() => setStep('questions')}
                disabled={studyMethod === 'custom' && !customStudyMethod.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                Continue to Assessment
              </Button>
            </div>
          </>
        )}

        {step === 'questions' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Brain className="w-6 h-6 text-blue-600" />
                Knowledge Assessment
              </DialogTitle>
              <DialogDescription>
                Help us personalize your learning experience by answering these questions about{' '}
                <span className="font-semibold">{courseName}</span>.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
                {error}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-2"
                  onClick={loadAssessment}
                >
                  Retry
                </Button>
              </div>
            )}

            <div className="space-y-6 py-4">
              {questions.map((question, index) => (
                <Card key={index} className="border-2 hover:border-blue-200 transition-colors">
                  <CardContent className="pt-6">
                    <div className="mb-4">
                      <Label className="text-base font-semibold text-gray-900">
                        {index + 1}. {question.question_text}
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Topic: {question.topic}
                      </p>
                    </div>

                    <RadioGroup
                      value={answers[index]?.toString()}
                      onValueChange={(value) => handleAnswerChange(index, parseInt(value))}
                    >
                      <div className="space-y-3">
                        {(question.options || []).map((option, optionIndex) => (
                          <div 
                            key={optionIndex} 
                            className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <RadioGroupItem value={optionIndex.toString()} id={`q${index}-opt${optionIndex}`} />
                            <Label 
                              htmlFor={`q${index}-opt${optionIndex}`}
                              className="cursor-pointer flex-1"
                            >
                              {option}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-gray-600">
                {Object.keys(answers).length} of {questions.length} questions answered
              </p>
              <Button
                onClick={handleSubmit}
                disabled={!allQuestionsAnswered}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                Submit Assessment
              </Button>
            </div>
          </>
        )}

        {step === 'submitting' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">Analyzing your responses...</p>
            <p className="text-sm text-gray-500">
              Creating your personalized learning path
            </p>
          </div>
        )}

        {step === 'complete' && evaluation && syllabus && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl text-green-600">
                <CheckCircle className="w-6 h-6" />
                Assessment Complete!
              </DialogTitle>
              <DialogDescription>
                Your personalized syllabus has been created
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Evaluation Summary */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Your Learning Profile
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Knowledge Level</p>
                      <p className="font-semibold text-gray-900 capitalize">
                        {evaluation.knowledge_level}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Knowledge Score</p>
                      <p className="font-semibold text-gray-900">
                        {evaluation.knowledge_percentage?.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Correct Answers</p>
                      <p className="font-semibold text-green-600">
                        {evaluation.correct_answers} / {evaluation.total_questions}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Learning Style</p>
                      <p className="font-semibold text-gray-900 capitalize">
                        {studyMethod.replace('_', ' ')}
                      </p>
                    </div>
                    {evaluation.known_topics && evaluation.known_topics.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600 mb-1">Strong Topics</p>
                        <div className="flex flex-wrap gap-1">
                          {evaluation.known_topics.map((topic: string, idx: number) => (
                            <span key={idx} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {evaluation.weak_topics && evaluation.weak_topics.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600 mb-1">Focus Areas</p>
                        <div className="flex flex-wrap gap-1">
                          {evaluation.weak_topics.map((topic: string, idx: number) => (
                            <span key={idx} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {evaluation.unknown_topics && evaluation.unknown_topics.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600 mb-1">New Topics to Learn</p>
                        <div className="flex flex-wrap gap-1">
                          {evaluation.unknown_topics.map((topic: string, idx: number) => (
                            <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Personalized Syllabus */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-1">Your Personalized Syllabus</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {syllabus.total_modules} modules • {syllabus.total_estimated_hours?.toFixed(1)} hours
                  </p>
                  <div className="space-y-4">
                    {syllabus.modules.slice(0, 3).map((mod: any, modIndex: number) => (
                      <div key={modIndex} className="border rounded-lg overflow-hidden">
                        {/* Module header */}
                        <div className="flex items-center gap-3 p-3 bg-gray-50">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                            {modIndex + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{mod.module_name}</p>
                            <p className="text-xs text-gray-500">
                              {mod.estimated_hours} hours • {mod.topics?.length || 0} topics
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {syllabus.total_modules > 3 && (
                      <p className="text-sm text-gray-500 text-center">
                        + {syllabus.total_modules - 3} more modules
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="text-center text-sm text-gray-600">
                <p>Redirecting to your course...</p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
