'use client';

import { CATEGORIES, CategoryId, getCategoryMeta } from '@/lib/categoryMeta';

interface CategoryBadgeProps {
  category: CategoryId | string | null | undefined;
  manual?: boolean;
  clickable?: boolean;
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
  confidence?: number | null;
  size?: 'sm' | 'md';
}

export default function CategoryBadge({
  category,
  manual = false,
  clickable = false,
  onClick,
  confidence = null,
  size = 'sm',
}: CategoryBadgeProps) {
  const meta = getCategoryMeta(category) || CATEGORIES[CATEGORIES.length - 1];

  const fontSize = size === 'md' ? 11 : 10;
  const padding = size === 'md' ? '3px 10px' : '2px 8px';

  return (
    <span
      onClick={onClick}
      title={
        confidence != null
          ? `${meta.description} — confidence ${Math.round(confidence * 100)}%`
          : meta.description
      }
      style={{
        padding,
        borderRadius: 999,
        fontSize,
        fontWeight: 600,
        color: meta.color,
        background: `${meta.color}20`,
        border: `1px solid ${meta.color}40`,
        cursor: clickable ? 'pointer' : 'default',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {meta.label}
      {manual && <span style={{ opacity: 0.9 }}>✓</span>}
    </span>
  );
}
