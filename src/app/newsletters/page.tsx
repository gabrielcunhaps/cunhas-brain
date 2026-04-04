import NewslettersView from '@/components/NewslettersView';

export default function NewslettersPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-[var(--text-primary)] text-2xl font-bold mb-6">Newsletters</h1>
      <NewslettersView />
    </div>
  );
}
