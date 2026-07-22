// app/admin/beta/page.tsx
import { isAdminRequest } from "@/lib/beta/adminAuth";
import AdminBetaDashboard from "./AdminBetaDashboard";

export default async function AdminBetaPage() {
  const { isAdmin } = await isAdminRequest();

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex items-center justify-center px-6">
        <p className="text-sm text-[#888]">Not authorized.</p>
      </div>
    );
  }

  return <AdminBetaDashboard />;
}
