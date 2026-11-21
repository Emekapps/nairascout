import type { Metadata } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
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
    <html lang="en" className={`${bricolage.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#FAFAF8] text-[#111814] font-sans antialiased selection:bg-[#0B6E4F]/15 selection:text-[#0B6E4F]"
      >
        {children}
      </body>
    </html>
  );
}
