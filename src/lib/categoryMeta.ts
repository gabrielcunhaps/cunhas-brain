export const CATEGORIES = [
  { id: 'netsuite_kt', label: 'NetSuite KT', color: '#6366f1', description: 'Internal KT sessions' },
  { id: 'manager_1on1', label: 'Manager 1:1', color: '#ec4899', description: 'Meetings with manager' },
  { id: 'customer_engagement', label: 'Customer', color: '#10b981', description: 'Customer engagements' },
  { id: 'student_lesson', label: 'Student', color: '#f59e0b', description: 'Student tutoring' },
  { id: 'others', label: 'Other', color: '#64748b', description: 'Uncategorized' },
] as const;

export type CategoryId = typeof CATEGORIES[number]['id'];

export function getCategoryMeta(id: string | null | undefined) {
  if (!id) return null;
  return CATEGORIES.find((c) => c.id === id) || null;
}

// Variables extracted from transcripts for each category, stored in
// `meeting_metadata` (category, variable, value). These power the
// category-aware chat filter.
export const CATEGORY_VARIABLES: Record<string, string[]> = {
  netsuite_kt: ['reminder'],
  manager_1on1: ['priority', 'todo', 'prep', 'decision'],
  customer_engagement: ['use_case', 'question', 'comment', 'objection', 'feature_request'],
  student_lesson: [],
  others: ['topic', 'decision', 'follow_up'],
};

export function getVariablesForCategory(categoryId: string | null | undefined): string[] {
  if (!categoryId) return [];
  return CATEGORY_VARIABLES[categoryId] || [];
}

export function isValidVariable(categoryId: string | null | undefined, variable: string | null | undefined): boolean {
  if (!categoryId || !variable) return false;
  return (CATEGORY_VARIABLES[categoryId] || []).includes(variable);
}
