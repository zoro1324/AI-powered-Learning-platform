import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
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
      const backendMessage = err.response?.data?.message;
      const backendError = err.response?.data?.error;
      setError(backendMessage || backendError || 'Failed to load assessment');
      setStep('questions');
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
      <DialogContent className="fixed inset-0 z-[100] flex w-screen h-screen max-w-none translate-x-0 translate-y-0 border-none bg-white p-0 shadow-none duration-0 sm:max-w-none rounded-none m-0 left-0 top-0">
        <div className="w-full h-full overflow-y-auto bg-slate-50 flex flex-col">
          <div className="max-w-4xl mx-auto w-full p-6 md:p-12 lg:p-20 flex-1 flex flex-col">
            {step === 'loading' && (
              <div className="flex-1 flex flex-col items-center justify-center py-20">
                <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-6" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Preparing Your Assessment</h2>
                <p className="text-gray-600 font-medium">Generating personalized questions based on the course content...</p>
              </div>
            )}

            {step === 'study-method' && (
              <div className="space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-left mb-10">
                  <h2 className="flex items-center gap-3 text-4xl font-bold tracking-tight text-gray-900">
                    <Target className="w-10 h-10 text-blue-600" />
                    How do you like to learn?
                  </h2>
                  <p className="text-xl mt-4 text-gray-600">
                    Tell us your preferred learning style for{' '}
                    <span className="font-bold text-gray-900">{courseName}</span>.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  <RadioGroup value={studyMethod} onValueChange={(value) => setStudyMethod(value as StudyMethod)} className="contents">
                    <Card
                      onClick={() => setStudyMethod('real_world')}
                      className={`cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${studyMethod === 'real_world' ? 'border-blue-500 ring-4 ring-blue-500/10 bg-blue-50/50' : 'border-gray-200'}`}
                    >
                      <CardContent className="pt-8 pb-8">
                        <div className="flex items-start space-x-4">
                          <RadioGroupItem value="real_world" id="real_world" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="real_world" className="cursor-pointer font-bold text-xl text-gray-900">
                              Real-World Examples
                            </Label>
                            <p className="text-gray-600 mt-3 leading-relaxed text-base font-medium">
                              Learn through practical applications and real-world scenarios you'll encounter in the field.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      onClick={() => setStudyMethod('theory_depth')}
                      className={`cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${studyMethod === 'theory_depth' ? 'border-blue-500 ring-4 ring-blue-500/10 bg-blue-50/50' : 'border-gray-200'}`}
                    >
                      <CardContent className="pt-8 pb-8">
                        <div className="flex items-start space-x-4">
                          <RadioGroupItem value="theory_depth" id="theory_depth" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="theory_depth" className="cursor-pointer font-bold text-xl text-gray-900">
                              Theory Depth
                            </Label>
                            <p className="text-gray-600 mt-3 leading-relaxed text-base font-medium">
                              Deep dive into core concepts, principles, and the theoretical foundations of the subject.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      onClick={() => setStudyMethod('project_based')}
                      className={`cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${studyMethod === 'project_based' ? 'border-blue-500 ring-4 ring-blue-500/10 bg-blue-50/50' : 'border-gray-200'}`}
                    >
                      <CardContent className="pt-8 pb-8">
                        <div className="flex items-start space-x-4">
                          <RadioGroupItem value="project_based" id="project_based" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="project_based" className="cursor-pointer font-bold text-xl text-gray-900">
                              Project-Based Learning
                            </Label>
                            <p className="text-gray-600 mt-3 leading-relaxed text-base font-medium">
                              Build hands-on projects while learning new concepts in a practical, output-driven way.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      onClick={() => setStudyMethod('custom')}
                      className={`cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${studyMethod === 'custom' ? 'border-blue-500 ring-4 ring-blue-500/10 bg-blue-50/50' : 'border-gray-200'}`}
                    >
                      <CardContent className="pt-8 pb-8">
                        <div className="flex items-start space-x-4">
                          <RadioGroupItem value="custom" id="custom" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="custom" className="cursor-pointer font-bold text-xl text-gray-900">
                              Custom Approach
                            </Label>
                            <p className="text-gray-600 mt-3 leading-relaxed text-base font-medium">
                              Describe your unique preferred learning style or specific goals.
                            </p>
                            {studyMethod === 'custom' && (
                              <Input
                                placeholder="e.g., Focus on accessibility and responsive design patterns"
                                className="mt-5 bg-white py-6 text-lg"
                                value={customStudyMethod}
                                onChange={(e) => setCustomStudyMethod(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </RadioGroup>
                </div>

                <div className="flex justify-end pt-10 border-t border-gray-200 mt-12 pb-12">
                  <Button
                    onClick={() => setStep('questions')}
                    disabled={studyMethod === 'custom' && !customStudyMethod.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-8 text-xl font-bold rounded-2xl shadow-xl hover:shadow-2xl active:scale-95 transition-all"
                  >
                    Continue to Assessment
                  </Button>
                </div>
              </div>
            )}

            {step === 'questions' && (
              <div className="space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-left mb-10">
                  <h2 className="flex items-center gap-3 text-4xl font-bold tracking-tight text-gray-900">
                    <Brain className="w-10 h-10 text-blue-600" />
                    Knowledge Assessment
                  </h2>
                  <p className="text-xl mt-4 text-gray-600">
                    We'll tailor the course to your current knowledge level on{' '}
                    <span className="font-bold text-gray-900">{courseName}</span>.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-8 py-6 rounded-2xl mb-8 flex items-center justify-between shadow-sm">
                    <span className="text-lg font-medium">{error}</span>
                    <Button
                      variant="outline"
                      size="lg"
                      className="ml-4 border-red-200 hover:bg-red-100 font-bold"
                      onClick={loadAssessment}
                    >
                      Retry
                    </Button>
                  </div>
                )}

                <div className="space-y-10">
                  {questions.map((question, index) => (
                    <Card key={index} className="border-none shadow-sm hover:shadow-md transition-all rounded-3xl overflow-hidden bg-white">
                      <CardContent className="p-10">
                        <div className="mb-10">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="bg-blue-600 text-white text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-widest">Question {index + 1}</span>
                            <span className="text-sm text-gray-400 font-bold uppercase tracking-wider">Topic: {question.topic}</span>
                          </div>
                          <Label className="text-3xl font-extrabold text-gray-900 leading-tight block">
                            {question.question_text}
                          </Label>
                        </div>

                        <RadioGroup
                          value={answers[index]?.toString()}
                          onValueChange={(value) => handleAnswerChange(index, parseInt(value))}
                          className="grid grid-cols-1 gap-5"
                        >
                          {(question.options || []).map((option, optionIndex) => (
                            <div
                              key={optionIndex}
                              onClick={() => handleAnswerChange(index, optionIndex)}
                              className={`flex items-start space-x-5 p-6 rounded-2xl border-2 transition-all cursor-pointer group ${answers[index] === optionIndex ? 'border-blue-500 bg-blue-50/80 shadow-md translate-x-1' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                            >
                              <RadioGroupItem value={optionIndex.toString()} id={`q${index}-opt${optionIndex}`} className="mt-1" />
                              <Label
                                htmlFor={`q${index}-opt${optionIndex}`}
                                className="cursor-pointer flex-1 text-xl font-semibold text-gray-800 leading-relaxed group-hover:text-gray-900 transition-colors"
                              >
                                {option}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-8 pt-12 border-t border-gray-200 pb-20 mt-12">
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="flex-1 md:w-64 h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-blue-600 transition-all duration-700 ease-out"
                        style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xl font-bold text-gray-700 whitespace-nowrap">
                      {Object.keys(answers).length} / {questions.length} answered
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={!allQuestionsAnswered}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-16 py-8 text-2xl font-black rounded-3xl shadow-2xl hover:shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                  >
                    Finish Assessment
                  </Button>
                </div>
              </div>
            )}

            {step === 'submitting' && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center animate-pulse">
                <Loader2 className="w-24 h-24 animate-spin text-blue-600 mb-10" />
                <h2 className="text-4xl font-black text-gray-900 mb-6">Analyzing Your Performance</h2>
                <p className="text-2xl text-gray-600 max-w-lg leading-relaxed font-medium">
                  We're algorithmically engineering your personalized learning journey based on your specific knowledge profile.
                </p>
              </div>
            )}

            {step === 'complete' && evaluation && syllabus && (
              <div className="space-y-12 py-10 animate-in fade-in zoom-in-95 duration-1000">
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-32 h-32 bg-green-100 rounded-full mb-4 shadow-inner">
                    <CheckCircle className="w-16 h-16 text-green-600" />
                  </div>
                  <h1 className="text-6xl font-black tracking-tighter text-gray-900">
                    Syllabus Locked In!
                  </h1>
                  <p className="text-2xl text-gray-600 font-medium">
                    Your personalized trajectory for <span className="font-bold text-gray-900 underline decoration-blue-500 decoration-4">{courseName}</span> is ready.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                  <div className="lg:col-span-5">
                    <Card className="bg-white border-none shadow-2xl rounded-[2.5rem] overflow-hidden h-full">
                      <CardContent className="p-12 space-y-10">
                        <div className="flex items-center gap-4">
                          <Sparkles className="w-10 h-10 text-blue-600" />
                          <h3 className="font-black text-3xl text-gray-900">Student Profile</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-10">
                          <div className="space-y-2">
                            <p className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Knowledge Level</p>
                            <p className="text-4xl font-black text-blue-700 capitalize">
                              {evaluation.knowledge_level}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Mastery Score</p>
                            <p className="text-4xl font-black text-blue-700">
                              {evaluation.knowledge_percentage?.toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        <div className="space-y-8 pt-6 border-t border-gray-100">
                          {evaluation.weak_topics && evaluation.weak_topics.length > 0 && (
                            <div className="space-y-4">
                              <p className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Critical Growth Areas</p>
                              <div className="flex flex-wrap gap-3">
                                {evaluation.weak_topics.map((topic: string, idx: number) => (
                                  <span key={idx} className="bg-amber-50 text-amber-600 text-sm font-black px-5 py-3 rounded-2xl border border-amber-100/50">
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {evaluation.unknown_topics && evaluation.unknown_topics.length > 0 && (
                            <div className="space-y-4">
                              <p className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Target Modules</p>
                              <div className="flex flex-wrap gap-3">
                                {evaluation.unknown_topics.map((topic: string, idx: number) => (
                                  <span key={idx} className="bg-blue-50 text-blue-600 text-sm font-black px-5 py-3 rounded-2xl border border-blue-100/50">
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="lg:col-span-7">
                    <Card className="bg-white border-none shadow-2xl rounded-[2.5rem] overflow-hidden h-full">
                      <CardContent className="p-12 space-y-10">
                        <div className="flex items-center justify-between">
                          <h3 className="font-black text-3xl text-gray-900">Custom Roadmap</h3>
                          <div className="flex gap-6 text-sm font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-5 py-2 rounded-full">
                            <span>{syllabus.total_modules} Modules</span>
                            <span>•</span>
                            <span>{syllabus.total_estimated_hours?.toFixed(1)} Total Hours</span>
                          </div>
                        </div>

                        <div className="space-y-5">
                          {syllabus.modules.slice(0, 4).map((mod: any, modIndex: number) => (
                            <div key={modIndex} className="flex items-center gap-8 p-6 bg-gray-50/30 rounded-3xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/10 transition-all group">
                              <div className="flex-shrink-0 w-16 h-16 bg-blue-600 text-white rounded-[1.25rem] flex items-center justify-center font-black text-2xl shadow-xl group-hover:scale-105 transition-transform">
                                {modIndex + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-xl text-gray-900 truncate">{mod.module_name}</p>
                                <div className="flex gap-4 mt-2">
                                  <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{mod.estimated_hours} Hours</span>
                                  <span className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-lg">{mod.topics?.length || 0} Key Topics</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {syllabus.total_modules > 4 && (
                            <div className="text-center pt-6">
                              <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-xs">
                                + {syllabus.total_modules - 4} Specialized Learning Blocks
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="text-center flex flex-col items-center gap-6 py-10 bg-blue-600 rounded-[3rem] shadow-2xl shadow-blue-500/30 text-white animate-bounce-subtle">
                  <Loader2 className="w-10 h-10 animate-spin" />
                  <p className="text-3xl font-black">Launching your specialized workspace...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
