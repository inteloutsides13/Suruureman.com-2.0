import { useState, useEffect, FormEvent } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PUBLIC_SOCIAL_SETTINGS_QUERY_KEY } from "@/components/social-links";

const SETTING_FIELDS = [
  { section: "Contact Information", fields: [
    { key: "contact_email", label: "Email Address", placeholder: "info@suruureman.com" },
    { key: "contact_phone", label: "Phone Number", placeholder: "+92 300 1234567" },
    { key: "contact_address", label: "Address", placeholder: "Lahore, Pakistan" },
  ]},
  { section: "Social Media Links", fields: [
    { key: "social_facebook", label: "Facebook URL", placeholder: "https://facebook.com/suruureman" },
    { key: "social_twitter", label: "Twitter / X URL", placeholder: "https://x.com/suruureman" },
    { key: "social_youtube", label: "YouTube URL", placeholder: "https://youtube.com/@suruureman" },
    { key: "social_tiktok", label: "TikTok URL", placeholder: "https://tiktok.com/@suruureman" },
    { key: "social_instagram", label: "Instagram URL", placeholder: "https://instagram.com/suruureman" },
  ]},
];

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch("/api/admin/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSettings(d.settings || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      if (!res.ok) { setError("Failed to save settings"); return; }
      await queryClient.invalidateQueries({ queryKey: PUBLIC_SOCIAL_SETTINGS_QUERY_KEY });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground font-sans text-sm transition-colors";
  const labelCls = "text-xs text-muted-foreground tracking-widest uppercase";

  if (loading) return <AdminLayout><p className="text-muted-foreground">Loading...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-heading text-xl font-bold text-foreground tracking-wider mb-8">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
        {SETTING_FIELDS.map((section) => (
          <div key={section.section} className="bg-card/40 border border-accent/15 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-accent tracking-widest uppercase">{section.section}</h2>
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className={labelCls}>{field.label}</label>
                <input
                  className={inputCls}
                  value={settings[field.key] ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        ))}

        {error && <p className="text-destructive text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent text-background font-heading tracking-widest text-xs uppercase hover:bg-accent/90 disabled:opacity-50 transition-all"
        >
          <Save size={14} />
          {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </form>
    </AdminLayout>
  );
}
