import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Sidebar } from '../components/Sidebar';

type Difficulty = 'Easy' | 'Intermediate' | 'Difficult';

interface Question {
  id: number;
  difficulty: Difficulty;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Answer {
  questionId: number;
  selectedOption: number | null;
  isCorrect: boolean;
  difficulty: Difficulty;
}

export default function AssessmentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseName, learningStyle } = location.state || {};
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const questions: Question[] = [
    // Easy Questions
    {
      id: 1,
      difficulty: 'Easy',
      question: 'What is the basic unit of data structure?',
      options: ['Array', 'Element', 'Node', 'Pointer'],
      correctAnswer: 1,
    },
    {
      id: 2,
      difficulty: 'Easy',
      question: 'Which data structure uses LIFO (Last In First Out)?',
      options: ['Queue', 'Stack', 'Array', 'List'],
      correctAnswer: 1,
    },
    // Intermediate Questions
    {
      id: 3,
      difficulty: 'Intermediate',
      question: 'What is the time complexity of binary search?',
      options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
      correctAnswer: 1,
    },
    {
      id: 4,
      difficulty: 'Intermediate',
      question: 'Which algorithm is used for finding shortest path?',
      options: ['Bubble Sort', 'Dijkstra\'s Algorithm', 'Linear Search', 'Merge Sort'],
      correctAnswer: 1,
    },
    // Difficult Questions
    {
      id: 5,
      difficulty: 'Difficult',
      question: 'What is the space complexity of a recursive Fibonacci function?',
      options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'],
      correctAnswer: 1,
    },
    {
      id: 6,
      difficulty: 'Difficult',
      question: 'Which data structure is best for LRU Cache implementation?',
      options: ['Array', 'Binary Tree', 'HashMap + Doubly Linked List', 'Stack'],
      correctAnswer: 2,
    },
  ];

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  const handleAnswer = (optionIndex: number | null) => {
    const isCorrect = optionIndex !== null && optionIndex === currentQuestion.correctAnswer;
    
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      selectedOption: optionIndex,
      isCorrect,
      difficulty: currentQuestion.difficulty,
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Navigate to results
      navigate('/learning-path', {
        state: {
          courseName,
          learningStyle,
          answers: newAnswers,
          questions,
        },
      });
    }
  };

  // Group questions by difficulty
  const questionsByDifficulty = questions.reduce((acc, q, idx) => {
    if (!acc[q.difficulty]) acc[q.difficulty] = [];
    acc[q.difficulty].push(idx);
    return acc;
  }, {} as Record<Difficulty, number[]>);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <div className="min-h-screen py-12 px-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-semibold text-gray-900 mb-4">
                Let's Understand Your Level
              </h1>
              <p className="text-gray-600 text-lg">
                Answer the following questions to personalize your learning path
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

            {/* Difficulty Indicator */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-200">
                <span className="text-sm font-medium text-gray-600">Difficulty:</span>
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-lg ${
                    currentQuestion.difficulty === 'Easy'
                      ? 'bg-green-100 text-green-700'
                      : currentQuestion.difficulty === 'Intermediate'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {currentQuestion.difficulty}
                </span>
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                {currentQuestion.question}
              </h2>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    className="w-full text-left px-6 py-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg mr-4 font-semibold text-gray-600">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Don't Know Option */}
            <div className="text-center">
              <button
                onClick={() => handleAnswer(null)}
                className="text-gray-600 hover:text-gray-900 font-medium underline"
              >
                I Don't Know This Question
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
