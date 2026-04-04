'use client';

import { useParams } from 'next/navigation';
import StudentDetail from '@/components/StudentDetail';

export default function StudentPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <StudentDetail studentId={id} />
    </div>
  );
}
