import StudentList from '@/components/StudentList';

export default function StudentsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-[var(--text-primary)] text-2xl font-bold mb-6">Students</h1>
      <StudentList />
    </div>
  );
}
