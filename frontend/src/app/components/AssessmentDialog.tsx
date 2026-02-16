import { useState } from 'react';
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
import { Loader2, CheckCircle, Brain, Sparkles } from 'lucide-react';
import { assessmentAPI, AssessmentQuestion } from '../../services/api';

interface AssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: number;
  courseName: string;
  onEnrollmentComplete: (enrollmentId: number) => void;
}

type AssessmentStep = 'loading' | 'questions' | 'submitting' | 'complete';

export default function AssessmentDialog({
  open,
  onOpenChange,
  courseId,
  courseName,
  onEnrollmentComplete,
}: AssessmentDialogProps) {
  const [step, setStep] = useState<AssessmentStep>('loading');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [evaluation, setEvaluation] = useState<any>(null);
  const [roadmap, setRoadmap] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load initial assessment when dialog opens
  const loadAssessment = async () => {
    try {
      setStep('loading');
      setError(null);
      const response = await assessmentAPI.generateInitialAssessment({
        course_id: courseId,
        course_name: courseName,
      });
      setQuestions(response.questions);
      setStep('questions');
    } catch (err: any) {
      console.error('Error loading assessment:', err);
      setError(err.response?.data?.error || 'Failed to load assessment');
      setStep('questions'); // Allow retry
    }
  };

  // Handle dialog open state
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !open) {
      // Dialog is opening
      loadAssessment();
    } else if (!newOpen) {
      // Dialog is closing - reset state
      setStep('loading');
      setQuestions([]);
      setAnswers({});
      setEvaluation(null);
      setRoadmap(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setAnswers({ ...answers, [questionIndex]: answer });
  };

  const handleSubmit = async () => {
    try {
      setStep('submitting');
      setError(null);

      // Convert answers object to array
      const answersArray = questions.map((_, index) => answers[index] || '');

      const response = await assessmentAPI.evaluateAssessment({
        course_id: courseId,
        course_name: courseName,
        questions: questions,
        answers: answersArray,
      });

      setEvaluation(response.evaluation);
      setRoadmap(response.roadmap);
      setStep('complete');

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
    questions.every((_, index) => answers[index] !== undefined && answers[index] !== '');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        {step === 'loading' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Generating personalized assessment...</p>
          </div>
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
                        {index + 1}. {question.question}
                      </Label>
                      {index < 2 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {index === 0 ? 'This helps us deliver content in your preferred format' : 
                           'This helps us set the right difficulty level'}
                        </p>
                      )}
                    </div>

                    <RadioGroup
                      value={answers[index]}
                      onValueChange={(value) => handleAnswerChange(index, value)}
                    >
                      <div className="space-y-3">
                        {question.options.map((option, optionIndex) => (
                          <div 
                            key={optionIndex} 
                            className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <RadioGroupItem value={option} id={`q${index}-opt${optionIndex}`} />
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

        {step === 'complete' && evaluation && roadmap && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl text-green-600">
                <CheckCircle className="w-6 h-6" />
                Assessment Complete!
              </DialogTitle>
              <DialogDescription>
                Your personalized learning path has been created
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
                      <p className="text-sm text-gray-600">Study Method</p>
                      <p className="font-semibold text-gray-900 capitalize">
                        {evaluation.study_method}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Knowledge Level</p>
                      <p className="font-semibold text-gray-900 capitalize">
                        {evaluation.knowledge_level}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Assessment Score</p>
                      <p className="font-semibold text-gray-900">{evaluation.score}</p>
                    </div>
                    {evaluation.weak_areas.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600">Focus Areas</p>
                        <p className="font-semibold text-gray-900">
                          {evaluation.weak_areas.length} topic(s)
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Personalized Roadmap */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4">Your Personalized Roadmap</h3>
                  <div className="space-y-2">
                    {roadmap.topics.map((topic: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{topic.topic_name}</p>
                          <p className="text-xs text-gray-500 capitalize">{topic.level}</p>
                        </div>
                      </div>
                    ))}
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
