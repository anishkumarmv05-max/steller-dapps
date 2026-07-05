import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'StellarVault — DeFi Yield Protocol on Stellar',
  description: 'Deposit XLM, earn yield, lock vaults for boosted returns. Built on Stellar Soroban smart contracts.',
  keywords: 'Stellar, Soroban, DeFi, yield, vault, XLM, blockchain',
  openGraph: {
    title: 'StellarVault',
    description: 'Earn yield on your XLM with Stellar smart contracts',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080b14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
