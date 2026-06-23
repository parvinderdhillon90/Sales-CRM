import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sales CRM — Internal',
  description: 'Internal sales team CRM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
