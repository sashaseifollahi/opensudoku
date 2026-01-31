import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sudoku Arena',
  description: 'Competitive multiplayer sudoku - race against humans and AI agents',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#fafafa',
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}
