import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "Cunha's Brain",
  description: 'Meeting intelligence hub',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0a0a0b] min-h-screen`}>
        <Nav />
        <main className="pt-14">{children}</main>
      </body>
    </html>
  );
}
