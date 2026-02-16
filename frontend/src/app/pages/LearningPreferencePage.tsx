import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Network, Video, FileText, BookOpen, Film } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';

type LearningStyle = 'mindmap' | 'videos' | 'summary' | 'books' | 'reels';

interface PreferenceOption {
  id: LearningStyle;
  icon: React.ElementType;
  title: string;
  description: string;
}

export default function LearningPreferencePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseName } = location.state || { courseName: 'Your Course' };
  const [selectedStyle, setSelectedStyle] = useState<LearningStyle | null>(null);

  const preferences: PreferenceOption[] = [
    {
      id: 'mindmap',
      icon: Network,
      title: 'Mind Map',
      description: 'Visual structured diagrams connecting concepts',
    },
    {
      id: 'videos',
      icon: Video,
      title: 'Videos',
      description: 'Comprehensive video lectures and tutorials',
    },
    {
      id: 'summary',
      icon: FileText,
      title: 'Summary Notes',
      description: 'Concise written summaries and key points',
    },
    {
      id: 'books',
      icon: BookOpen,
      title: 'Books',
      description: 'Detailed reading materials and textbooks',
    },
    {
      id: 'reels',
      icon: Film,
      title: 'Short Reels',
      description: 'Quick bite-sized video content',
    },
  ];

  const handleContinue = () => {
    if (selectedStyle) {
      navigate('/assessment', { state: { courseName, learningStyle: selectedStyle } });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <div className="min-h-screen py-12 px-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-semibold text-gray-900 mb-4">
                How Do You Prefer to Learn?
              </h1>
              <p className="text-gray-600 text-lg">
                Choose your preferred learning style for {courseName}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {preferences.map((pref) => {
                const Icon = pref.icon;
                const isSelected = selectedStyle === pref.id;
                
                return (
                  <button
                    key={pref.id}
                    onClick={() => setSelectedStyle(pref.id)}
                    className={`bg-white rounded-2xl p-6 border-2 transition-all hover:shadow-lg ${
                      isSelected
                        ? 'border-blue-500 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div
                      className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                          : 'bg-gray-100'
                      }`}
                    >
                      <Icon className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{pref.title}</h3>
                    <p className="text-gray-600 text-sm">{pref.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="text-center">
              <button
                onClick={handleContinue}
                disabled={!selectedStyle}
                className="px-12 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Assessment
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
