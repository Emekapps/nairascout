import { cookies } from 'next/headers';
import { getNigerianStates } from '@/lib/nairascout-store';
import { RegisterWizard } from '@/components/auth/RegisterWizard';

export const dynamic = 'force-dynamic';

interface RegisterPageProps {
  searchParams: Promise<{ refEvent?: string; refScout?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const capturedRefEvent = params.refEvent || cookieStore.get('ns_ref_event')?.value || null;
  const capturedRefScout = params.refScout || cookieStore.get('ns_ref_scout')?.value || null;
  const initialStates = await getNigerianStates();

  return (
    <RegisterWizard
      capturedRefEvent={capturedRefEvent}
      capturedRefScout={capturedRefScout}
      initialStates={initialStates}
    />
  );
}
