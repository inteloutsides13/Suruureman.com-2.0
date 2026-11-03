import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { Trash2, Mail } from "lucide-react";

interface Message {
  id: number; name: string; email: string; message: string; createdAt: string;
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    try {
      const res = await adminFetch("/api/admin/messages");
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    if (!confirm("Delete this message?")) return;
    setDeleting(id);
    await adminFetch(`/api/admin/messages/${id}`, { method: "DELETE" });
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setDeleting(null);
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground tracking-wider">Messages</h1>
          <p className="text-sm text-muted-foreground">{messages.length} total</p>
        </div>
        <Mail size={20} className="text-accent" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-card/40 border border-accent/10 rounded-xl animate-pulse" />)}
        </div>
      ) : messages.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center border border-dashed border-accent/20 rounded-3xl bg-card/20">
          <Mail size={32} className="text-accent/30 mb-4" />
          <p className="text-muted-foreground text-sm tracking-widest uppercase">No messages yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="bg-card/40 border border-accent/15 rounded-xl px-5 py-4 hover:border-accent/30 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-sans text-sm font-medium text-foreground">{msg.name}</span>
                    <a href={`mailto:${msg.email}`} className="text-xs text-accent hover:underline">{msg.email}</a>
                    <span className="text-xs text-muted-foreground/50">{formatDate(msg.createdAt)}</span>
                  </div>
                  <p
                    className={`text-sm text-muted-foreground leading-relaxed cursor-pointer ${expanded === msg.id ? "" : "line-clamp-2"}`}
                    onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                  >
                    {msg.message}
                  </p>
                  {msg.message.length > 120 && (
                    <button
                      onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                      className="text-xs text-accent/70 hover:text-accent mt-1 transition-colors"
                    >
                      {expanded === msg.id ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(msg.id)}
                  disabled={deleting === msg.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 disabled:opacity-40 transition-all shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
