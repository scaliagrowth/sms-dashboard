import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messaging Dashboard',
  description: 'Simple SMS inbox built with Next.js, Twilio, and Google Sheets.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
