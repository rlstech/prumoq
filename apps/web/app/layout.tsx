import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrumoQ',
  description: 'Gestão da Qualidade para Obras',
};

export const viewport: Viewport = {
  themeColor: '#163B50',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
