import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'US Visa Translation Tester',
  description: 'MVP translation tester for US visa applications (DS-160/ESTA)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
