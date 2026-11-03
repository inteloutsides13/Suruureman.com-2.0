import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { hasIrabAccessRole, useAdminAuth } from "@/hooks/use-admin-auth";
import { useSeo } from "@/hooks/use-seo";

export function IrabLoginRequired() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-[70vh] bg-background flex items-center justify-center px-4" dir="rtl" data-testid="irab-login-required">
      <div className="w-full max-w-lg rounded-2xl border border-accent/20 bg-card/50 p-8 text-center shadow-2xl shadow-black/30">
        <h1 className="font-urdu text-3xl leading-[1.8] text-foreground">اِعْراب — e'raab</h1>
        <p className="mt-4 font-urdu text-lg leading-[2.2] text-muted-foreground">
          اِعْراب استعمال کرنے کے لیے پہلے سائن اِن کریں۔
        </p>
        <button
          type="button"
          onClick={() => navigate("/admin/login")}
          className="mt-7 rounded-lg bg-primary px-6 py-3 font-heading text-sm tracking-wider text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}

export function IrabAccessGuard({ children }: { children: ReactNode }) {
  useSeo({
    title: "اِعْراب — e'raab",
    description: "اِعْراب — e'raab: اپنے اردو کلام کی عبارت اور سطری ترتیب برقرار رکھتے ہوئے اِعْراب لگائیں۔",
    ogTitle: "اِعْراب — e'raab | Suruur E Man",
    ogDescription: "اِعْراب — e'raab: اردو کلام کے لیے ایک محتاط اور قابلِ اعتماد ٹول۔",
  });
  const { isAuthenticated, role } = useAdminAuth();

  if (!isAuthenticated || !hasIrabAccessRole(role)) {
    return <IrabLoginRequired />;
  }

  return <>{children}</>;
}