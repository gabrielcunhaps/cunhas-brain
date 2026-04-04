'use client';

import { useState, useEffect, useRef } from 'react';
import { useChatSession } from '@/hooks/useChatSession';
import ChatMessage from './ChatMessage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  selectedMeetingIds: number[];
}

export default function ChatInterface({
  selectedMeetingIds,
}: ChatInterfaceProps) {
  const { sessionId, resetSession } = useChatSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history when sessionId is available
  useEffect(() => {
    if (!sessionId) return;

    async function loadHistory() {
      try {
        const res = await fetch(`/api/chat?sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(
            data.map((m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setHistoryLoaded(true);
      }
    }
    loadHistory();
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !sessionId) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          meetingIds: selectedMeetingIds,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Chat request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';

      // Add empty assistant message
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: assistantContent,
          };
          return updated;
        });
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Something went wrong';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    resetSession();
    setMessages([]);
    setHistoryLoaded(false);
  };

  if (selectedMeetingIds.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💬</div>
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
            Select meetings to start chatting
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            Choose one or more meetings from the sidebar to chat about their
            transcripts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="text-sm text-[var(--text-secondary)]">
          {selectedMeetingIds.length} meeting
          {selectedMeetingIds.length !== 1 ? 's' : ''} selected
        </div>
        <button
          onClick={handleNewChat}
          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
        >
          New Chat
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {!historyLoaded ? (
          <div className="text-sm text-[var(--text-muted)] text-center py-8">
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)] text-center py-8">
            Ask anything about the selected meetings.
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your meetings..."
            rows={1}
            disabled={loading}
            className="flex-1 resize-none px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1.5 ml-1">
          Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
