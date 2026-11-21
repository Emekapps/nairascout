import { renderAdminPage } from '../_loader';

export const dynamic = 'force-dynamic';

export default async function AdminVerificationsPage() {
  return renderAdminPage('verifications');
}
