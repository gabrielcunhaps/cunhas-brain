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
