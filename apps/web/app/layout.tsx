import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrumoQ',
  description: 'Gestão da Qualidade para Obras',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
