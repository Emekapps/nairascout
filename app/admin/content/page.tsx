import { renderAdminPage } from '../_loader';

export const dynamic = 'force-dynamic';

// NS-FND-007: Admin Policies & Help Centre Content Editor route (/admin/content)
export default async function AdminContentPage() {
  return renderAdminPage('content');
}
