import type { Metadata } from 'next';
import { Lato, Inter, Lexend } from 'next/font/google';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import './globals.css';

// NS-PDP-001: Lato (400, 700, 900) primary font + Inter tabular-nums + Lexend 800 wordmark
const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-sans',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-numeric',
  display: 'swap',
});

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['800'],
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
