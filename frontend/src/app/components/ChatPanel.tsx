import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Loader2, Bot, User, Sparkles, BookOpen, Trash2, MessageSquare, History, ChevronRight } from 'lucide-react';
import { chatAPI, ChatMessage } from '../../services/api';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface ChatPanelProps {
  context: string;
  topicName: string;
  courseName: string;
  hasContent: boolean;
  enrollmentId?: number;
}

export function ChatPanel({
  context,
  topicName,
  courseName,
  hasContent,
  enrollmentId,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on mount
  useEffect(() => {
    if (enrollmentId) {
      setIsLoadingHistory(true);
      chatAPI
        .getChatHistory(enrollmentId)
        .then((response) => {
          setAllMessages(response.messages);
          // If no topic selected, show all messages
          if (!selectedTopic) {
            setMessages(response.messages);
          }
        })
        .catch((error) => {
          console.error('Failed to load chat history:', error);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      setIsLoadingHistory(false);
    }
  }, [enrollmentId]);

  // Group messages by topic
  const topicGroups = useMemo(() => {
    const groups: { [key: string]: ChatMessage[] } = {};
    allMessages.forEach((msg) => {
      const topic = msg.topic_name || 'General';
      if (!groups[topic]) {
        groups[topic] = [];
      }
      groups[topic].push(msg);
    });
    return groups;
  }, [allMessages]);

  // Filter messages by selected topic
  useEffect(() => {
    if (selectedTopic) {
      setMessages(allMessages.filter(msg => msg.topic_name === selectedTopic));
    } else {
      setMessages(allMessages);
    }
  }, [selectedTopic, allMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !hasContent || !enrollmentId) return;

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
        enrollment_id: enrollmentId,
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
      // Reload all messages to update history
      if (enrollmentId) {
        chatAPI.getChatHistory(enrollmentId).then((res) => {
          setAllMessages(res.messages);
        });
      }
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
  }, [input, isLoading, hasContent, context, topicName, courseName, enrollmentId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = useCallback(async () => {
    if (!enrollmentId || isClearing) return;
    
    if (!confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
      return;
    }
    
    setIsClearing(true);
    try {
      await chatAPI.clearChatHistory(enrollmentId);
      setMessages([]);
      setAllMessages([]);
      setSelectedTopic(null);
      setInput('');
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      alert('Failed to clear chat history. Please try again.');
    } finally {
      setIsClearing(false);
    }
  }, [enrollmentId, isClearing]);


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
    <div className="flex h-full">
      {/* History Sidebar */}
      {showHistory && Object.keys(topicGroups).length > 0 && (
        <div className="w-64 border-r border-gray-200 flex flex-col bg-gray-50">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-700">Conversation History</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHistory(false)}
              className="h-6 w-6 p-0"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <button
                onClick={() => setSelectedTopic(null)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                  !selectedTopic
                    ? "bg-neutral-200 text-neutral-900 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                )}
              >
                <div className="flex items-center justify-between">
                  <span>All Messages</span>
                  <span className="text-[10px] opacity-70">({allMessages.length})</span>
                </div>
              </button>
              {Object.entries(topicGroups).map(([topic, msgs]) => (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                    selectedTopic === topic
                      ? "bg-neutral-200 text-neutral-900 font-medium"
                      : "hover:bg-gray-100 text-gray-700"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3 h-3 shrink-0" />
                    <span className="truncate flex-1">{topic}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 truncate">
                      {msgs[msgs.length - 1]?.content.slice(0, 30)}...
                    </span>
                    <span className="text-[10px] opacity-70">({msgs.length})</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1">
        {/* Chat header with history toggle and clear button */}
        {!isLoadingHistory && (
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Object.keys(topicGroups).length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowHistory(!showHistory)}
                  className="h-7 px-2 text-xs"
                >
                  <History className="w-3 h-3 mr-1" />
                  {showHistory ? 'Hide' : 'Show'} History
                </Button>
              )}
              {selectedTopic && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <ChevronRight className="w-3 h-3" />
                  <span className="font-medium">{selectedTopic}</span>
                </div>
              )}
              {!selectedTopic && messages.length > 0 && (
                <>
                  <Bot className="w-4 h-4 text-neutral-700" />
                  <span className="text-xs font-medium text-gray-700">Chat</span>
                  <span className="text-xs text-gray-500">({messages.length} messages)</span>
                </>
              )}
            </div>
            {messages.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearChat}
                disabled={isClearing}
                className="h-7 px-2 text-xs hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                {isClearing ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-3 h-3 mr-1" />
                )}
                Clear All
              </Button>
            )}
          </div>
        )}
      
      {/* Messages area */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {isLoadingHistory && (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-700 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Loading chat history...</p>
            </div>
          )}
          
          {!isLoadingHistory && messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-gray-900 font-medium mb-1">
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
                      if (!enrollmentId) return;
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
                          enrollment_id: enrollmentId,
                        })
                        .then((res) => {
                          setMessages((prev) => [
                            ...prev,
                            { role: 'assistant', content: res.response },
                          ]);
                          // Reload all messages to update history
                          if (enrollmentId) {
                            chatAPI.getChatHistory(enrollmentId).then((response) => {
                              setAllMessages(response.messages);
                            });
                          }
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
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs text-gray-700 transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-3 h-3 text-neutral-700 shrink-0" />
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
                <div className="w-6 h-6 rounded-md bg-neutral-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-gray-100 text-gray-900 border border-gray-200'
                )}
              >
                {msg.role === 'assistant' ? (
                  <div className="chat-markdown prose prose-sm prose-gray max-w-none">
                    <ReactMarkdown
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        h1: ({ ...props }) => <h1 className="text-sm font-bold text-gray-900 mt-3 mb-1" {...props} />,
                        h2: ({ ...props }) => <h2 className="text-sm font-bold text-gray-900 mt-3 mb-1" {...props} />,
                        h3: ({ ...props }) => <h3 className="text-xs font-semibold text-gray-900 mt-2 mb-1" {...props} />,
                        p: ({ ...props }) => <p className="mb-1.5" {...props} />,
                        code: ({ ...props }) => {
                          const { className } = props;
                          const isInline = !className?.includes('language-');
                          if (isInline) {
                            return <code className="bg-gray-200 text-pink-600 px-1 py-0.5 rounded text-[10px]" {...props} />;
                          }
                          return <code className={cn(className, "font-mono")} {...props} />;
                        },
                        pre: ({ ...props }) => (
                          <pre className="bg-[#1e1e1e] text-[#d4d4d4] rounded-lg p-3 overflow-x-auto my-2 text-xs border border-gray-800 shadow-md not-prose" {...props} />
                        ),
                        ul: ({ ...props }) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                        li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
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
              <div className="w-6 h-6 rounded-md bg-neutral-900 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-gray-100 rounded-xl px-3 py-2 flex items-center gap-2 border border-gray-200">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-700" />
                <span className="text-xs text-gray-500">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this topic..."
            rows={1}
            className="flex-1 bg-gray-50 text-gray-900 border border-gray-200 text-xs rounded-xl px-3 py-2.5 resize-none outline-none focus:ring-1 focus:ring-neutral-900/20 placeholder-gray-500 max-h-[120px]"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          AI answers based on generated content
        </p>
      </div>
      </div>
    </div>
  );
}
