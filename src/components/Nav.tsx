'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/chat', label: 'Chat' },
  { href: '/newsletters', label: 'Newsletters' },
  { href: '/github', label: 'GitHub' },
  { href: '/artifacts', label: 'Artifacts' },
  { href: '/students', label: 'Students' },
  { href: '/logs', label: 'Logs' },
  { href: '/settings', label: 'Settings' },
];

export default function Nav() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-[var(--surface-1)] border-b border-[var(--border)] flex items-center justify-between px-6 z-50">
      <Link href="/dashboard" className="text-lg font-semibold text-[var(--text-primary)]">
        Cunha&apos;s Brain
      </Link>

      <div className="flex items-center gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith(link.href)
                ? 'text-[var(--accent-hover)] bg-[var(--surface-2)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
