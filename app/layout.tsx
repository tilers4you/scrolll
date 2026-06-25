import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Keelstone — Custom Homes & Additions',
  description: 'Architecture, structure, and finish — under one contract. Ground-up custom homes and considered additions across the United States.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
