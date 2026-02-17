import React, { useState } from 'react';
import { podcastAPI } from '../../services/api';

interface PersonaOption {
  person1: string;
  person2: string;
}

type Step = 'input' | 'personas' | 'scenarios' | 'generating' | 'complete';

const PodcastPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('input');
  const [content, setContent] = useState('');
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaOption | null>(null);
  const [scenarioOptions, setScenarioOptions] = useState<string[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContentSubmit = async () => {
    if (!content.trim()) {
      setError('Please enter some content');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await podcastAPI.generatePersonaOptions(content);
      setPersonaOptions(response.options);
      setCurrentStep('personas');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate persona options');
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaSelect = async (personas: PersonaOption) => {
    setSelectedPersonas(personas);
    setLoading(true);
    setError(null);

    try {
      const response = await podcastAPI.generateScenarioOptions(content, personas);
      setScenarioOptions(response.options);
      setCurrentStep('scenarios');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate scenario options');
    } finally {
      setLoading(false);
    }
  };

  const handleScenarioSelect = async (scenario: string) => {
    setSelectedScenario(scenario);
    setCurrentStep('generating');
    setLoading(true);
    setError(null);

    try {
      const response = await podcastAPI.generatePodcast({
        text: content,
        instruction: scenario,
        person1: selectedPersonas?.person1,
        person2: selectedPersonas?.person2,
      });
      
      setAudioUrl(response.audio_url);
      setCurrentStep('complete');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate podcast');
      setCurrentStep('scenarios');
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setCurrentStep('input');
    setContent('');
    setPersonaOptions([]);
    setSelectedPersonas(null);
    setScenarioOptions([]);
    setSelectedScenario(null);
    setAudioUrl(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Podcast Generator</h1>
          <p className="text-gray-600">
            Transform your content into engaging audio conversations
          </p>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            {['Input', 'Personas', 'Scenarios', 'Generate'].map((step, index) => {
              const stepKeys: Step[] = ['input', 'personas', 'scenarios', 'generating'];
              const currentIndex = stepKeys.indexOf(currentStep);
              const stepIndex = index;
              const isActive = stepIndex === currentIndex;
              const isCompleted = stepIndex < currentIndex || currentStep === 'complete';

              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <span
                      className={`mt-2 text-sm font-medium ${
                        isActive ? 'text-blue-600' : 'text-gray-600'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                  {index < 3 && (
                    <div
                      className={`flex-1 h-1 mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: Input Content */}
        {currentStep === 'input' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Enter Your Content</h2>
            <p className="text-gray-600 mb-4">
              Paste the text content you want to convert into a podcast conversation.
            </p>
            <textarea
              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="mt-4 flex justify-end">
              <button
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                onClick={handleContentSubmit}
                disabled={loading || !content.trim()}
              >
                {loading ? 'Generating...' : 'Next: Choose Personas'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Personas */}
        {currentStep === 'personas' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Choose Conversation Style</h2>
            <p className="text-gray-600 mb-6">
              Select the pair of personas that will have the conversation
            </p>
            <div className="space-y-4">
              {personaOptions.map((option, index) => (
                <button
                  key={index}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  onClick={() => handlePersonaSelect(option)}
                  disabled={loading}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {option.person1} ↔ {option.person2}
                      </p>
                    </div>
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                onClick={() => setCurrentStep('input')}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Select Scenario */}
        {currentStep === 'scenarios' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Choose Conversation Topic</h2>
            <p className="text-gray-600 mb-2">
              Selected: <span className="font-semibold">{selectedPersonas?.person1}</span> and{' '}
              <span className="font-semibold">{selectedPersonas?.person2}</span>
            </p>
            <p className="text-gray-600 mb-6">Select the conversation style or focus</p>
            <div className="space-y-4">
              {scenarioOptions.map((option, index) => (
                <button
                  key={index}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  onClick={() => handleScenarioSelect(option)}
                  disabled={loading}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{option}</p>
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                onClick={() => setCurrentStep('personas')}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Generating */}
        {currentStep === 'generating' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Generating Your Podcast</h2>
              <p className="text-gray-600 text-center">
                Creating conversation script and synthesizing audio...
                <br />
                This may take a few minutes.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {currentStep === 'complete' && audioUrl && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Podcast Generated Successfully!
            </h2>
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Personas</p>
                <p className="font-semibold">
                  {selectedPersonas?.person1} & {selectedPersonas?.person2}
                </p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Scenario</p>
                <p className="font-semibold">{selectedScenario}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Audio</p>
                <audio
                  controls
                  className="w-full"
                  src={`http://localhost:8000${audioUrl}`}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                onClick={resetFlow}
              >
                Create Another Podcast
              </button>
              <a
                href={`http://localhost:8000${audioUrl}`}
                download
                className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center"
              >
                Download Audio
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PodcastPage;
