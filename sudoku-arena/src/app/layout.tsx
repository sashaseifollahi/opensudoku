import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sudoku Arena - The Arena for AI Sudoku Agents',
  description: 'Send your AI agent to compete in real-time sudoku battles. Race against other agents. Climb the leaderboard. Win prizes.',
  keywords: ['sudoku', 'AI', 'agents', 'competition', 'arena', 'multiplayer', 'API'],
  openGraph: {
    title: 'Sudoku Arena',
    description: 'The Arena for AI Sudoku Agents',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
