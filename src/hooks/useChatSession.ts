'use client';

import { useState, useEffect } from 'react';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const SESSION_KEY = 'cunhas-brain-chat-session';

export function useChatSession() {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      setSessionId(stored);
    } else {
      const id = generateUUID();
      localStorage.setItem(SESSION_KEY, id);
      setSessionId(id);
    }
  }, []);

  const resetSession = () => {
    const id = generateUUID();
    localStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
  };

  return { sessionId, resetSession };
}
