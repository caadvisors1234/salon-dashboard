import { GoogleOAuthCard } from "@/components/admin/google-oauth-card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">システム設定</h2>
      <GoogleOAuthCard />
    </div>
  );
}
