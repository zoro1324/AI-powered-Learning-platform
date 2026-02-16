import { useState } from 'react';
import { useLocation } from 'react-router';
import { CheckCircle2, XCircle, Award, RefreshCw } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface QuizAnswer {
  questionId: number;
  selectedOption: number;
  isCorrect: boolean;
}

export default function FinalQuizPage() {
  const location = useLocation();
  const { courseName } = location.state || {};
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const quizQuestions: QuizQuestion[] = [
    {
      id: 1,
      question: 'What is the primary advantage of using a hash table?',
      options: [
        'Constant time complexity for search operations',
        'Sorted data storage',
        'Low memory usage',
        'Simple implementation',
      ],
      correctAnswer: 0,
    },
    {
      id: 2,
      question: 'In a binary search tree, what property must be maintained?',
      options: [
        'All nodes must be balanced',
        'Left child < Parent < Right child',
        'All leaves must be at the same level',
        'Parent must be larger than all children',
      ],
      correctAnswer: 1,
    },
    {
      id: 3,
      question: 'What is the worst-case time complexity of Quick Sort?',
      options: ['O(n log n)', 'O(n²)', 'O(log n)', 'O(n)'],
      correctAnswer: 1,
    },
    {
      id: 4,
      question: 'Which data structure is used in Breadth-First Search?',
      options: ['Stack', 'Queue', 'Heap', 'Array'],
      correctAnswer: 1,
    },
    {
      id: 5,
      question: 'What is the space complexity of merge sort?',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
      correctAnswer: 2,
    },
    {
      id: 6,
      question: 'Which operation is NOT efficient in a linked list?',
      options: ['Insertion at beginning', 'Deletion at beginning', 'Random access', 'Traversal'],
      correctAnswer: 2,
    },
    {
      id: 7,
      question: 'What is a complete binary tree?',
      options: [
        'All levels are filled except possibly the last',
        'All nodes have two children',
        'Tree is perfectly balanced',
        'All leaves are at the same level',
      ],
      correctAnswer: 0,
    },
    {
      id: 8,
      question: 'In dynamic programming, what is memoization?',
      options: [
        'Storing results of expensive function calls',
        'Optimizing memory usage',
        'Recursive function calls',
        'Iterative approach',
      ],
      correctAnswer: 0,
    },
  ];

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const totalQuestions = quizQuestions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedOption(optionIndex);
  };

  const handleNext = () => {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === currentQuestion.correctAnswer;
    const newAnswer: QuizAnswer = {
      questionId: currentQuestion.id,
      selectedOption,
      isCorrect,
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    setSelectedOption(null);

    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setShowResults(true);
    }
  };

  const correctAnswersCount = answers.filter((a) => a.isCorrect).length;
  const incorrectAnswers = answers.filter((a) => !a.isCorrect);
  const scorePercentage = (correctAnswersCount / totalQuestions) * 100;

  if (showResults) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        
        <main className="flex-1 ml-64">
          <div className="min-h-screen py-12 px-8">
            <div className="max-w-4xl mx-auto">
              {/* Results Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 mb-8 text-white text-center">
                <Award className="w-16 h-16 mx-auto mb-4" />
                <h1 className="text-4xl font-semibold mb-4">Quiz Complete!</h1>
                <div className="flex items-center justify-center gap-8">
                  <div>
                    <p className="text-blue-100 mb-1">Your Score</p>
                    <p className="text-5xl font-bold">{Math.round(scorePercentage)}%</p>
                  </div>
                  <div>
                    <p className="text-blue-100 mb-1">Correct Answers</p>
                    <p className="text-3xl font-bold">{correctAnswersCount} / {totalQuestions}</p>
                  </div>
                </div>
              </div>

              {/* Performance Message */}
              <div className={`rounded-2xl p-6 mb-8 ${
                scorePercentage >= 70 ? 'bg-green-50 border-2 border-green-200' :
                scorePercentage >= 40 ? 'bg-yellow-50 border-2 border-yellow-200' :
                'bg-red-50 border-2 border-red-200'
              }`}>
                <h3 className={`text-xl font-semibold mb-2 ${
                  scorePercentage >= 70 ? 'text-green-800' :
                  scorePercentage >= 40 ? 'text-yellow-800' :
                  'text-red-800'
                }`}>
                  {scorePercentage >= 70 ? '🎉 Excellent Work!' :
                   scorePercentage >= 40 ? '👍 Good Progress!' :
                   '💪 Keep Learning!'}
                </h3>
                <p className={
                  scorePercentage >= 70 ? 'text-green-700' :
                  scorePercentage >= 40 ? 'text-yellow-700' :
                  'text-red-700'
                }>
                  {scorePercentage >= 70 
                    ? "You've demonstrated strong understanding of the material. Keep up the great work!"
                    : scorePercentage >= 40
                    ? "You're making good progress. Review the incorrect topics to strengthen your understanding."
                    : "Don't worry! Learning takes time. Review the material and try again."}
                </p>
              </div>

              {/* Incorrect Topics Section */}
              {incorrectAnswers.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                    Topics to Review
                  </h2>
                  
                  <div className="space-y-4">
                    {incorrectAnswers.map((ans, idx) => {
                      const question = quizQuestions.find(q => q.id === ans.questionId);
                      return (
                        <div key={idx} className="border border-red-200 rounded-xl p-6 bg-red-50">
                          <div className="flex items-start gap-3 mb-3">
                            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 mb-3">{question?.question}</p>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-red-700">Your answer:</span>
                                  <span className="text-sm font-medium text-red-800">
                                    {question?.options[ans.selectedOption]}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-green-700">Correct answer:</span>
                                  <span className="text-sm font-medium text-green-800">
                                    {question?.options[question.correctAnswer]}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Auto-generated Summary */}
                  <div className="mt-6 p-6 bg-blue-50 rounded-xl">
                    <h3 className="font-semibold text-gray-900 mb-3">📝 Summary of Topics to Review:</h3>
                    <ul className="space-y-2">
                      {incorrectAnswers.slice(0, 3).map((ans, idx) => {
                        const question = quizQuestions.find(q => q.id === ans.questionId);
                        return (
                          <li key={idx} className="flex items-start gap-2 text-gray-700">
                            <span className="text-blue-500 font-bold">{idx + 1}.</span>
                            <span>Review concepts related to: {question?.question.split('?')[0]}?</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <button className="w-full mt-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5" />
                    Suggest Revision Module
                  </button>
                </div>
              )}

              {/* All Correct */}
              {incorrectAnswers.length === 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                  <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Perfect Score!
                  </h2>
                  <p className="text-gray-600">
                    You answered all questions correctly. Excellent mastery of the material!
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center mt-8">
                <button 
                  onClick={() => window.location.reload()}
                  className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Retake Quiz
                </button>
                <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all">
                  Continue Learning
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <div className="min-h-screen py-12 px-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-semibold text-gray-900 mb-4">
                Test Your Understanding
              </h1>
              <p className="text-gray-600 text-lg">
                Final assessment for {courseName}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </span>
                <span className="text-sm font-medium text-gray-600">
                  {Math.round(progress)}% Complete
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                {currentQuestion.question}
              </h2>

              <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all font-medium ${
                      selectedOption === index
                        ? 'border-blue-500 bg-blue-50 text-gray-900'
                        : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mr-4 font-semibold ${
                      selectedOption === index
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </button>
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={selectedOption === null}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentQuestionIndex < totalQuestions - 1 ? 'Next Question' : 'Submit Quiz'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
