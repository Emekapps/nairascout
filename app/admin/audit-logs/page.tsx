import { renderAdminPage } from '../_loader';

export const dynamic = 'force-dynamic';

export default async function AdminAuditLogsPage() {
  return renderAdminPage('audit_logs');
}
