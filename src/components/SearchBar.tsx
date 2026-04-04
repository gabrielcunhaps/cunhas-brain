'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({ onSearch, placeholder = 'Search meetings...' }: SearchBarProps) {
  const [value, setValue] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, onSearch]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded-lg px-4 py-2.5
        text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)]
        focus:outline-none focus:border-[var(--accent)] transition-colors"
    />
  );
}
