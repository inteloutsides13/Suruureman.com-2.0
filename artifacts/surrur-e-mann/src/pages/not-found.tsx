import { Link } from "wouter";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSeo } from "@/hooks/use-seo";

export default function NotFound() {
  useSeo({ title: "Page Not Found", noindex: true });
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <div className="relative mb-8">
        <h1 className="font-heading text-9xl font-bold text-accent opacity-20">404</h1>
        <div className="absolute inset-0 flex items-center justify-center">
          <h2 className="font-urdu text-5xl text-foreground text-glow-gold">صفحہ موجود نہیں</h2>
        </div>
      </div>
      
      <p className="font-heading text-muted-foreground tracking-widest uppercase mb-10 max-w-md">
        The page you are looking for has vanished like a forgotten verse.
      </p>
      
      <Link href="/">
        <Button size="lg" className="bg-accent text-background hover:bg-accent/90 font-heading tracking-widest uppercase rounded-full px-8 h-14 shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
          <Home className="mr-2 h-5 w-5" /> Return Home
        </Button>
      </Link>
    </div>
  );
}
