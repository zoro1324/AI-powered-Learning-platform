import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, Sparkles, BookOpen } from 'lucide-react';
import { chatAPI, ChatMessage } from '../../services/api';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';

interface ChatPanelProps {
  context: string;
  topicName: string;
  courseName: string;
  hasContent: boolean;
}

export function ChatPanel({
  context,
  topicName,
  courseName,
  hasContent,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset chat when topic changes
  useEffect(() => {
    setMessages([]);
    setInput('');
  }, [topicName]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !hasContent) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const response = await chatAPI.sendMessage({
        message: trimmed,
        context,
        topic_name: topicName,
        course_name: courseName,
        chat_history: messages,
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content:
          'Sorry, I encountered an error. Please try again. ' +
          (error?.response?.data?.error || ''),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, hasContent, context, topicName, courseName, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Simple markdown rendering for chat messages
  const renderMarkdown = (text: string) => {
    let html = text
      .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-white mt-3 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-sm font-bold text-white mt-3 mb-1">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _l, code) => {
        return `<pre class="bg-black/30 rounded-lg p-2 overflow-x-auto my-2 text-xs"><code>${code
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</code></pre>`;
      })
      .replace(/`([^`]+)`/g, '<code class="bg-black/20 text-pink-300 px-1 py-0.5 rounded text-xs">$1</code>')
      .replace(/^(?!<[h23pre])(.*\S.*)$/gm, '<p class="mb-1.5">$1</p>');
    return html;
  };

  // ─── No content state ────────────────────────────────────────────────────

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-12">
        <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-3">
          <BookOpen className="w-6 h-6 text-gray-500" />
        </div>
        <p className="text-sm text-gray-400 text-center mb-1">
          Generate Notes First
        </p>
        <p className="text-xs text-gray-500 text-center">
          The chatbot uses generated content as its knowledge base. Generate notes for this topic to start chatting.
        </p>
      </div>
    );
  }

  // ─── Main chat UI ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-gray-300 font-medium mb-1">
                AI Topic Assistant
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Ask questions about "{topicName}"
              </p>
              {/* Suggested questions */}
              <div className="space-y-2">
                {[
                  'Explain the main concepts',
                  'Give me a real-world example',
                  'What are the key takeaways?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      const msg = suggestion;
                      setInput('');
                      const userMsg: ChatMessage = { role: 'user', content: msg };
                      setMessages((prev) => [...prev, userMsg]);
                      setIsLoading(true);
                      chatAPI
                        .sendMessage({
                          message: msg,
                          context,
                          topic_name: topicName,
                          course_name: courseName,
                          chat_history: [],
                        })
                        .then((res) => {
                          setMessages((prev) => [
                            ...prev,
                            { role: 'assistant', content: res.response },
                          ]);
                        })
                        .catch(() => {
                          setMessages((prev) => [
                            ...prev,
                            { role: 'assistant', content: 'Sorry, something went wrong.' },
                          ]);
                        })
                        .finally(() => {
                          setIsLoading(false);
                        });
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                'flex gap-2',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-200'
                )}
              >
                {msg.role === 'assistant' ? (
                  <div
                    className="chat-markdown"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(msg.content),
                    }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-md bg-gray-600 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-gray-800 rounded-xl px-3 py-2 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span className="text-xs text-gray-400">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this topic..."
            rows={1}
            className="flex-1 bg-gray-800 text-white text-xs rounded-xl px-3 py-2.5 resize-none outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500 max-h-[120px]"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          AI answers based on generated content
        </p>
      </div>
    </div>
  );
}
