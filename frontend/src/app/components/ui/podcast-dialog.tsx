import React, { useState } from 'react';
import { podcastAPI } from '../../../services/api';
import { Loader2, Headphones, ChevronRight, Download, Play } from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface PersonaOption {
  person1: string;
  person2: string;
}

interface PodcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  topicName: string;
  onPodcastGenerated?: (data: { audioUrl: string; personas: PersonaOption; scenario: string; generatedAt: string }) => void;
}

type Step = 'personas' | 'scenarios' | 'generating' | 'complete';

export function PodcastDialog({
  open,
  onOpenChange,
  content,
  topicName,
  onPodcastGenerated,
}: PodcastDialogProps) {
  const [currentStep, setCurrentStep] = useState<Step>('personas');
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaOption | null>(null);
  const [scenarioOptions, setScenarioOptions] = useState<string[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load personas when dialog opens
  React.useEffect(() => {
    if (open && personaOptions.length === 0) {
      loadPersonaOptions();
    }
  }, [open]);

  const loadPersonaOptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await podcastAPI.generatePersonaOptions(content);
      setPersonaOptions(response.options);
      setCurrentStep('personas');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load persona options');
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
      
      // Notify parent component
      if (onPodcastGenerated && selectedPersonas) {
        onPodcastGenerated({
          audioUrl: response.audio_url,
          personas: selectedPersonas,
          scenario,
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate podcast');
      setCurrentStep('scenarios');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setCurrentStep('personas');
    setPersonaOptions([]);
    setSelectedPersonas(null);
    setScenarioOptions([]);
    setSelectedScenario(null);
    setAudioUrl(null);
    setError(null);
    onOpenChange(false);
  };

  const getAudioUrl = () => {
    if (!audioUrl) return '';
    return audioUrl.startsWith('http') 
      ? audioUrl 
      : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${audioUrl}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-blue-600" />
            Generate Audio Podcast
          </DialogTitle>
          <DialogDescription>
            Convert "{topicName}" into an engaging audio conversation
          </DialogDescription>
        </DialogHeader>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* Step: Personas */}
        {currentStep === 'personas' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Choose Conversation Style
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Select the pair of personas that will discuss this topic
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-2">
                {personaOptions.map((option, index) => (
                  <button
                    key={index}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left flex items-center justify-between group"
                    onClick={() => handlePersonaSelect(option)}
                    disabled={loading}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-900">
                        {option.person1} ↔ {option.person2}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Scenarios */}
        {currentStep === 'scenarios' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Choose Discussion Focus
              </h3>
              <p className="text-sm text-gray-600 mb-1">
                Selected: <span className="font-medium">{selectedPersonas?.person1}</span> and{' '}
                <span className="font-medium">{selectedPersonas?.person2}</span>
              </p>
              <p className="text-sm text-gray-500 mb-4">
                How should they approach the topic?
              </p>
            </div>

            <div className="space-y-2">
              {scenarioOptions.map((option, index) => (
                <button
                  key={index}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left flex items-center justify-between group"
                  onClick={() => handleScenarioSelect(option)}
                  disabled={loading}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {index + 1}
                    </div>
                    <span className="font-medium text-gray-900">{option}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentStep('personas')}
              className="w-full"
            >
              Back to Personas
            </Button>
          </div>
        )}

        {/* Step: Generating */}
        {currentStep === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
              <div className="absolute inset-0 blur-xl bg-blue-400 opacity-20 animate-pulse"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Creating Your Podcast
            </h3>
            <p className="text-sm text-gray-600 text-center max-w-md">
              Generating conversation script and synthesizing audio...
              <br />
              This may take 2-5 minutes.
            </p>
          </div>
        )}

        {/* Step: Complete */}
        {currentStep === 'complete' && audioUrl && (
          <div className="space-y-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Play className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Podcast Ready!
              </h3>
              <p className="text-sm text-gray-600">
                Your audio conversation has been generated
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Speakers</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedPersonas?.person1} & {selectedPersonas?.person2}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Focus</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedScenario}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Audio</p>
                <audio
                  controls
                  className="w-full"
                  src={getAudioUrl()}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Close
              </Button>
              <a
                href={getAudioUrl()}
                download={`${topicName.replace(/[^a-z0-9]/gi, '_')}_podcast.mp3`}
                className="flex-1"
              >
                <Button variant="default" className="w-full gap-2">
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
