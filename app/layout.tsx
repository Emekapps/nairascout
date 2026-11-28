import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import './globals.css';

// NS-PDP-001, NS-UI-310: Self-hosted Lato (400, 700, 900) + Inter tabular-nums + Lexend 800 wordmark
const lato = localFont({
  src: [
    { path: './fonts/lato-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/lato-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/lato-900.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

const inter = localFont({
  src: [
    { path: './fonts/inter-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/inter-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/inter-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-numeric',
  display: 'swap',
});

const lexend = localFont({
  src: [{ path: './fonts/lexend-800.woff2', weight: '800', style: 'normal' }],
  variable: '--font-brand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NairaScout — Thirteen-Generation Referral Marketing & Social Commerce',
  description:
    'Discover trusted products, share traceable product referrals, and earn transparent commissions across up to thirteen generations of genuine commercial sales.',
  openGraph: {
    title: 'NairaScout — Thirteen-Generation Referral Marketing & Social Commerce',
    description:
      'Discover trusted products, share traceable product referrals, and earn transparent commissions across up to thirteen generations of genuine commercial sales.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NairaScout — Thirteen-Generation Referral Marketing & Social Commerce',
    description:
      'Discover trusted products, share traceable product referrals, and earn transparent commissions across up to thirteen generations of genuine commercial sales.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${lato.variable} ${inter.variable} ${lexend.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20 selection:text-foreground"
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
