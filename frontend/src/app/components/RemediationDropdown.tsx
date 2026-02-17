import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Sparkles } from 'lucide-react';
import { cn } from './ui/utils';

interface RemediationNote {
  sub_topic: string;
  content: string;
  generatedAt: string;
}

interface RemediationDropdownProps {
  notes: RemediationNote[];
  renderContent: (markdown: string) => string;
}

export function RemediationDropdown({ notes, renderContent }: RemediationDropdownProps) {
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});

  if (notes.length === 0) return null;

  const toggleNote = (idx: number) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div className="mt-8 space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-amber-200 to-transparent" />
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">
            Review Notes ({notes.length})
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-amber-200 to-transparent" />
      </div>

      <p className="text-sm text-gray-500 text-center">
        These focused notes were generated to help you with concepts you found challenging.
      </p>

      {/* Collapsible notes */}
      <div className="space-y-3">
        {notes.map((note, idx) => {
          const isExpanded = !!expandedNotes[idx];

          return (
            <div
              key={idx}
              className="border border-amber-200 rounded-xl overflow-hidden bg-white shadow-sm"
            >
              <button
                onClick={() => toggleNote(idx)}
                className={cn(
                  'w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors',
                  isExpanded
                    ? 'bg-amber-50 border-b border-amber-200'
                    : 'hover:bg-amber-50/50'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {note.sub_topic}
                  </p>
                  <p className="text-xs text-gray-400">
                    Generated {new Date(note.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 py-4">
                  <article
                    className="prose prose-gray prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: renderContent(note.content),
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
