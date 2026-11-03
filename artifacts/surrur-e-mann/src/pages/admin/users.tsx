import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { Users, Plus, Pencil, Trash2, X, Check, Code2, Shield } from "lucide-react";

interface AdminUser {
  id: number;
  email: string;
  role: "developer" | "admin";
  name: string;
  createdAt: string;
}

interface FormState {
  email: string;
  name: string;
  password: string;
  role: "developer" | "admin";
}

const emptyForm = (): FormState => ({ email: "", name: "", password: "", role: "admin" });

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function loadUsers() {
    setLoading(true);
    adminFetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  }

  function startEdit(u: AdminUser) {
    setEditingId(u.id);
    setForm({ email: u.email, name: u.name, password: "", role: u.role });
    setError("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  async function handleSave() {
    if (!form.email) { setError("Email is required"); return; }
    if (!editingId && !form.password) { setError("Password is required for new users"); return; }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, string> = { email: form.email, name: form.name, role: form.role };
      if (form.password) body.password = form.password;
      const res = await adminFetch(
        editingId ? `/api/admin/users/${editingId}` : "/api/admin/users",
        { method: editingId ? "PUT" : "POST", body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save"); return; }
      setShowForm(false);
      loadUsers();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await adminFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) loadUsers();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground tracking-wider mb-1 flex items-center gap-3">
              <Users size={24} className="text-blue-400" />
              User Management
            </h1>
            <p className="text-sm text-muted-foreground">Manage admin panel accounts and roles.</p>
          </div>
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-background font-heading tracking-widest text-xs hover:bg-accent/90 transition-all"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>

        {showForm && (
          <div className="bg-card/60 border border-accent/20 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-heading text-sm tracking-widest uppercase text-accent">
                {editingId ? "Edit User" : "New User"}
              </h2>
              <button onClick={cancelForm} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-2">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground text-sm transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">Display Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground text-sm transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">
                  Password {editingId ? "(leave blank to keep current)" : "*"}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingId ? "••••••••" : ""}
                  className="w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground text-sm transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">Role *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "developer" | "admin" })}
                  className="w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground text-sm transition-colors">
                  <option value="admin">Admin</option>
                  <option value="developer">Developer</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background font-heading tracking-widest text-xs hover:bg-accent/90 disabled:opacity-50 transition-all">
                <Check size={14} />
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={cancelForm}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-accent/20 text-muted-foreground hover:text-foreground font-heading tracking-widest text-xs transition-all">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-card/40 border border-accent/15 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading users...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-accent/10">
                  <th className="text-left px-6 py-4 text-xs font-heading tracking-widest uppercase text-muted-foreground">User</th>
                  <th className="text-left px-6 py-4 text-xs font-heading tracking-widest uppercase text-muted-foreground">Role</th>
                  <th className="text-left px-6 py-4 text-xs font-heading tracking-widest uppercase text-muted-foreground">Created</th>
                  <th className="px-6 py-4 w-24" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-accent/5 hover:bg-accent/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-sans text-foreground">{u.email}</div>
                      {u.name && <div className="text-xs text-muted-foreground mt-0.5">{u.name}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {u.role === "developer" ? (
                        <div className="flex items-center gap-1.5">
                          <Code2 size={12} className="text-blue-400" />
                          <span className="text-xs font-heading tracking-widest uppercase text-blue-400">Developer</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Shield size={12} className="text-accent" />
                          <span className="text-xs font-heading tracking-widest uppercase text-accent">Admin</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => startEdit(u)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(u.id)} disabled={deletingId === u.id}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-40">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-blue-400/80 font-heading tracking-wider uppercase mb-1">Developer Access Only</p>
          <p className="text-xs text-muted-foreground">User management is restricted to Developer accounts. Admins cannot view or modify user accounts.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
