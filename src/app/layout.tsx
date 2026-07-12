import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'myUNO',
  description: 'Operating platform for serviced living in Phuket',
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
