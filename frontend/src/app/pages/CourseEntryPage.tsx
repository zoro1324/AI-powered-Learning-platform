import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';

export default function CourseEntryPage() {
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState('');

  const handleContinue = () => {
    if (courseName.trim()) {
      navigate('/learning-preference', { state: { courseName } });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-semibold text-gray-900 mb-4">
                Enter the Course You Want to Learn
              </h1>
              <p className="text-gray-600 text-lg">
                Start your personalized learning journey
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="Type course name (e.g., Data Structures, AI, Marketing…)"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleContinue()}
                />
              </div>

              <button
                onClick={handleContinue}
                disabled={!courseName.trim()}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
