import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Network, Video, FileText, BookOpen, Film, CheckCircle2, Award } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';

interface Answer {
  questionId: number;
  selectedOption: number | null;
  isCorrect: boolean;
  difficulty: string;
}

interface Question {
  id: number;
  difficulty: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

export default function LearningPathPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseName, learningStyle, answers, questions } = location.state || {};
  
  const [completedModules, setCompletedModules] = useState<Set<number>>(new Set());

  // Calculate level based on correct answers
  const correctAnswers = answers?.filter((a: Answer) => a.isCorrect).length || 0;
  const totalQuestions = questions?.length || 6;
  const score = (correctAnswers / totalQuestions) * 100;
  
  let level: 'Beginner' | 'Intermediate' | 'Advanced';
  if (score >= 70) level = 'Advanced';
  else if (score >= 40) level = 'Intermediate';
  else level = 'Beginner';

  // Get correct and incorrect questions
  const correctQuestions = answers?.filter((a: Answer) => a.isCorrect) || [];
  const incorrectQuestions = answers?.filter((a: Answer) => !a.isCorrect) || [];

  const toggleModuleComplete = (moduleId: number) => {
    const newCompleted = new Set(completedModules);
    if (newCompleted.has(moduleId)) {
      newCompleted.delete(moduleId);
    } else {
      newCompleted.add(moduleId);
    }
    setCompletedModules(newCompleted);
  };

  const handleProceedToQuiz = () => {
    navigate('/final-quiz', { state: { courseName, learningStyle, answers, questions } });
  };

  const renderLearningContent = (type: string, moduleId: number) => {
    switch (type) {
      case 'mindmap':
        return (
          <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
            <div className="flex items-start justify-center gap-8">
              <div className="text-center">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg mb-2">
                  <span className="font-semibold text-gray-700">Core Concept</span>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center shadow">
                    <span className="text-sm text-gray-600">Topic A</span>
                  </div>
                  <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center shadow">
                    <span className="text-sm text-gray-600">Topic B</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'videos':
        return (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl aspect-video flex items-center justify-center">
              <Video className="w-16 h-16 text-white opacity-50" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-300 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'reels':
        return (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900 rounded-xl aspect-[9/16] flex items-center justify-center">
                <Film className="w-12 h-12 text-white opacity-50" />
              </div>
            ))}
          </div>
        );
      
      case 'books':
        return (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6">
            <div className="flex gap-6">
              <div className="w-32 h-48 bg-white rounded-lg shadow-lg flex items-center justify-center">
                <BookOpen className="w-12 h-12 text-gray-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-3">Chapter 1: Introduction</h4>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-300 rounded"></div>
                  <div className="h-3 bg-gray-300 rounded"></div>
                  <div className="h-3 bg-gray-300 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>
        );
      
      default: // summary
        return (
          <div className="bg-blue-50 rounded-xl p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Key Points:</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5">1</span>
                <span className="text-gray-700">Understanding fundamental concepts and principles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5">2</span>
                <span className="text-gray-700">Practical applications and real-world examples</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5">3</span>
                <span className="text-gray-700">Best practices and common pitfalls to avoid</span>
              </li>
            </ul>
          </div>
        );
    }
  };

  const overallProgress = (completedModules.size / 4) * 100;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <div className="min-h-screen py-12 px-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 mb-8 text-white">
              <h1 className="text-4xl font-semibold mb-4">Your Personalized Learning Path</h1>
              <div className="flex items-center gap-4">
                <Award className="w-8 h-8" />
                <div>
                  <p className="text-blue-100 mb-1">Your Level</p>
                  <span className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 rounded-lg font-semibold text-lg">
                    {level}
                  </span>
                </div>
                <div className="ml-8">
                  <p className="text-blue-100 mb-1">Score</p>
                  <span className="text-2xl font-bold">{correctAnswers}/{totalQuestions}</span>
                </div>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Overall Progress</h3>
                <span className="text-sm font-medium text-gray-600">
                  {completedModules.size} / 4 modules completed
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                {/* eslint-disable-next-line react/forbid-dom-props */}
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            {/* Module 1 - Correct Answers (Summary) */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Module 1: Foundation Concepts
                  </h2>
                  <p className="text-gray-600">Topics you already understand well</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                  Mastered
                </span>
              </div>

              <div className="bg-green-50 rounded-xl p-6 mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Summary:</h4>
                <ul className="space-y-2">
                  {correctQuestions.map((ans: Answer, idx: number) => {
                    const q = questions.find((q: Question) => q.id === ans.questionId);
                    return (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{q?.question}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button
                onClick={() => toggleModuleComplete(1)}
                className={`w-full py-3 rounded-xl font-medium transition-all ${
                  completedModules.has(1)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
                }`}
              >
                {completedModules.has(1) ? '✓ Completed' : 'Mark as Complete'}
              </button>
            </div>

            {/* Module 2-4 - Incorrect Answers (Learning Style Format) */}
            {[2, 3, 4].map((moduleId) => {
              const startIdx = (moduleId - 2) * Math.ceil(incorrectQuestions.length / 3);
              const moduleQuestions = incorrectQuestions.slice(
                startIdx,
                startIdx + Math.ceil(incorrectQuestions.length / 3)
              );

              if (moduleQuestions.length === 0 && moduleId > 2) return null;

              return (
                <div key={moduleId} className="bg-white rounded-2xl shadow-lg p-8 mb-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        Module {moduleId}: Learning Area {moduleId - 1}
                      </h2>
                      <p className="text-gray-600">Topics to strengthen your understanding</p>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                      Learning
                    </span>
                  </div>

                  {moduleQuestions.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Topics Covered:</h4>
                      <ul className="space-y-2 mb-6">
                        {moduleQuestions.map((ans: Answer, idx: number) => {
                          const q = questions.find((q: Question) => q.id === ans.questionId);
                          return (
                            <li key={idx} className="flex items-start gap-2 text-gray-700">
                              <span className="text-blue-500">•</span>
                              {q?.question}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {renderLearningContent(learningStyle, moduleId)}

                  <button
                    onClick={() => toggleModuleComplete(moduleId)}
                    className={`w-full py-3 rounded-xl font-medium transition-all mt-6 ${
                      completedModules.has(moduleId)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
                    }`}
                  >
                    {completedModules.has(moduleId) ? '✓ Completed' : 'Mark as Complete'}
                  </button>
                </div>
              );
            })}

            {/* Proceed Button */}
            <div className="text-center mt-8">
              <button
                onClick={handleProceedToQuiz}
                className="px-12 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl"
              >
                Proceed to Final Quiz
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
