import { useParams, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  useGetPoem,
  useListPoems,
  useListPoets,
  useListCategories,
  getListPoemsQueryKey,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Share2,
  Heart,
  Check,
  Copy,
  X,
  Eye,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { truncateMetaDescription, useSeo } from "@/hooks/use-seo";
import { PoemCard } from "@/components/poem-card";
import { BreadcrumbJsonLd } from "@/components/breadcrumb-json-ld";
import { trackEvent, trackPageView } from "@/lib/analytics";
import { readLocalStorageValue, writeLocalStorageValue } from "@/lib/browser-storage";

// ── Local helpers: track which poems THIS user has liked ──────────────────
function getLikedPoems(): number[] {
  try {
    return JSON.parse(readLocalStorageValue("likedPoems") || "[]");
  } catch {
    return [];
  }
}
function setLikedPoems(ids: number[]) {
  writeLocalStorageValue("likedPoems", JSON.stringify(ids));
}

// ── Share menu ─────────────────────────────────────────────────────────────
function ShareMenu({
  title,
  poetName,
  onClose,
}: {
  title: string;
  poetName: string;
  onClose: () => void;
}) {
  const url = window.location.href;
  const text = encodeURIComponent(`${title} — ${poetName}`);
  const encodedUrl = encodeURIComponent(url);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1500);
    } catch {
      /* ignore */
    }
  }

  const options = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${text}%20${encodedUrl}`,
      color: "text-green-400",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
    {
      label: "Twitter / X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${text}`,
      color: "text-sky-400",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.713 5.892zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "text-blue-400",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-14 left-0 z-50 w-48 bg-card border border-accent/20 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent/10">
        <span className="font-heading text-xs tracking-widest uppercase text-muted-foreground">
          Share
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="py-1">
        {options.map((opt) => (
          <a
            key={opt.label}
            href={opt.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition-colors"
          >
            <span className={opt.color}>{opt.icon}</span>
            <span className="font-sans text-sm text-foreground">
              {opt.label}
            </span>
          </a>
        ))}
        <button
          onClick={copyLink}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition-colors border-t border-accent/10"
        >
          {copied ? (
            <Check size={16} className="text-accent" />
          ) : (
            <Copy size={16} className="text-muted-foreground" />
          )}
          <span className="font-sans text-sm text-foreground">
            {copied ? "Copied!" : "Copy Link"}
          </span>
        </button>
      </div>
    </motion.div>
  );
}

export function PoemBreadcrumb({ poem }: { poem: { id: number; title: string } }) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", href: "/" },
          { name: "Poems", href: "/poems" },
          { name: poem.title, href: `/poems/${poem.id}` },
        ]}
      />
      <nav className="flex items-center gap-2 mb-10 text-xs font-heading tracking-widest uppercase text-muted-foreground">
        <Link href="/" className="hover:text-accent transition-colors">
          Home
        </Link>
        <ChevronRight size={12} className="opacity-40" />
        <Link href="/poems" className="hover:text-accent transition-colors">
          Poems
        </Link>
        <ChevronRight size={12} className="opacity-40" />
        <span className="text-accent truncate max-w-[160px]">{poem.title}</span>
      </nav>
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function PoemDetail() {
  const { id } = useParams<{ id: string }>();
  const poemId = parseInt(id || "0", 10);
  const [shareOpen, setShareOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState<number | null>(null);

  const { mutate: likePoem } = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      fetch(`/api/poems/${id}/like`, { method: "POST" }).then((r) => r.json() as Promise<{ likes: number }>),
  });
  const { mutate: unlikePoem } = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      fetch(`/api/poems/${id}/unlike`, { method: "POST" }).then((r) => r.json() as Promise<{ likes: number }>),
  });

  useEffect(() => {
    setIsLiked(getLikedPoems().includes(poemId));
  }, [poemId]);

  const { data: poem, isLoading, isError } = useGetPoem(poemId);
  const { data: poetsData } = useListPoets();
  const { data: categoriesData } = useListCategories();
  const poetProfile = poem
    ? poetsData?.poets.find((poet) => poet.name.trim() === poem.poetName.trim())
    : undefined;
  const poemCategory = poem
    ? categoriesData?.categories.find(
        (category) =>
          category.slug === poem.category || category.name === poem.category,
      )
    : undefined;
  // Seed likeCount from server once poem loads
  useEffect(() => {
    if (poem && likeCount === null) setLikeCount(poem.likes);
  }, [poem, likeCount]);

  // Related poems — same poet, exclude current
  const { data: relatedData } = useListPoems(
    { poetName: poem?.poetName, limit: 5 },
    { query: { enabled: !!poem, queryKey: getListPoemsQueryKey({ poetName: poem?.poetName, limit: 5 }) } },
  );
  const relatedPoems = (relatedData?.poems ?? [])
    .filter((p) => p.id !== poemId)
    .slice(0, 4);

  // Analytics: track poem view once poem loads
  useEffect(() => {
    if (poem) {
      trackPageView(window.location.pathname, poem.titleUrdu);
      trackEvent("poem_view", {
        poem_id: poem.id,
        poem_title: poem.titleUrdu,
        poet_name: poem.poetNameUrdu,
      });
    }
  }, [poem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useSeo({
    title: poem
      ? `${[poem.title, poem.titleUrdu].filter(Boolean).join(" | ")} — ${
          [poem.poetName, poem.poetNameUrdu].filter(Boolean).join(" | ") || "Urdu Poetry"
        }`
      : undefined,
    description: poem
      ? truncateMetaDescription(
          `Read ${poem.title}${poem.titleUrdu ? ` (${poem.titleUrdu})` : ""}${
            poem.poetName ? ` by ${poem.poetName}` : ""
          } in the ${poemCategory?.name ?? poem.category} Urdu poetry collection.`,
        )
      : undefined,
    ogTitle: poem
      ? `${poem.titleUrdu || poem.title} — ${
          poem.poetNameUrdu || poem.poetName
        }`
      : undefined,
    ogDescription: poem ? truncateMetaDescription(poem.content) : undefined,
    ogImage: poem?.imageUrl ?? undefined,
    ogType: "article",
    noindex: !isLoading && (isError || !poem),
  });

  async function handleShareClick() {
    const url = window.location.href;
    trackEvent("share_click", {
      poem_id: poem?.id,
      poem_title: poem?.titleUrdu,
      share_method: "button",
    });
    if (poem?.id) {
      fetch(`/api/poems/${poem.id}/share`, { method: "POST" }).catch(() => {});
    }
    if (navigator.share && poem) {
      try {
        await navigator.share({
          title: poem.titleUrdu,
          text: `${poem.titleUrdu} — ${poem.poetNameUrdu}`,
          url,
        });
        return;
      } catch {
        /* fall through to menu */
      }
    }
    setShareOpen((o) => !o);
  }

  function handleLike() {
    if (isLiked) {
      // Optimistic unlike
      const newCount = Math.max(0, (likeCount ?? 0) - 1);
      setIsLiked(false);
      setLikeCount(newCount);
      setLikedPoems(getLikedPoems().filter((x) => x !== poemId));
      trackEvent("unlike_click", { poem_id: poemId });
      unlikePoem(
        { id: poemId },
        {
          onSuccess: (data) => setLikeCount(data.likes),
          onError: () => {
            setIsLiked(true);
            setLikeCount(likeCount ?? 0);
          },
        },
      );
    } else {
      // Optimistic like
      const newCount = (likeCount ?? 0) + 1;
      setIsLiked(true);
      setLikeCount(newCount);
      setLikedPoems([...getLikedPoems(), poemId]);
      trackEvent("like_click", {
        poem_id: poemId,
        poem_title: poem?.titleUrdu,
      });
      likePoem(
        { id: poemId },
        {
          onSuccess: (data) => setLikeCount(data.likes),
          onError: () => {
            setIsLiked(false);
            setLikeCount((likeCount ?? 0) - 1);
          },
        },
      );
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(201,168,76,0.3)]" />
        <p className="mt-8 font-urdu text-2xl text-accent animate-pulse">
          انتظار فرمائیں...
        </p>
      </div>
    );
  }

  if (isError || !poem) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 min-h-[80vh] flex flex-col items-center justify-center text-center">
        <h2 className="font-urdu text-4xl text-destructive mb-4">
          کلام نہیں ملا
        </h2>
        <p className="font-heading text-muted-foreground tracking-widest uppercase text-sm">
          Poem Not Found
        </p>
      </div>
    );
  }

  const dateObj = new Date(poem.createdAt);
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const displayLikes = likeCount ?? poem.likes;

  return (
    <div className="w-full relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        {poem.imageUrl ? (
          <>
            <img
              src={poem.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-10 mix-blend-luminosity grayscale-[50%]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(352_73%_36%_/_0.05),_hsl(340_25%_4%_/_1)_70%)]" />
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <PoemBreadcrumb poem={poem} />

        {/* ── Poem card ── */}
        <motion.article
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative bg-card/60 backdrop-blur-xl border border-accent/20 rounded-[2rem] p-8 md:p-16 shadow-2xl shadow-black/50"
        >
          <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-accent/40 rounded-tl-xl" />
          <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-accent/40 rounded-tr-xl" />
          <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-accent/40 rounded-bl-xl" />
          <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-accent/40 rounded-br-xl" />

          <header className="text-center mb-16 border-b border-accent/10 pb-12">
            {poemCategory ? (
              <Link
                href={`/poems?category=${encodeURIComponent(poemCategory.slug)}`}
                className="inline-block px-4 py-1 rounded-full bg-accent/5 border border-accent/20 text-accent font-urdu text-lg mb-6 hover:bg-accent/10 transition-colors"
              >
                {poem.categoryUrdu}
              </Link>
            ) : (
              <span className="inline-block px-4 py-1 rounded-full bg-accent/5 border border-accent/20 text-accent font-urdu text-lg mb-6">
                {poem.categoryUrdu}
              </span>
            )}
            <h1 className="urdu-text text-center text-4xl md:text-5xl lg:text-6xl font-bold text-foreground text-glow-gold mb-8 leading-[1.8] !tracking-normal">
              {poem.titleUrdu || poem.title}
            </h1>
            <div className="flex items-center justify-center gap-2 text-muted-foreground font-urdu text-2xl">
              {poetProfile ? (
                <Link
                  href={`/poets/${poetProfile.id}`}
                  className="text-accent hover:text-accent/80 transition-colors"
                >
                  {poem.poetNameUrdu}
                </Link>
              ) : (
                <span className="text-accent">{poem.poetNameUrdu}</span>
              )}
              <span>از</span>
            </div>
            <div className="mt-8 flex justify-center gap-6 text-sm text-muted-foreground font-sans">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-accent" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2" title="Views">
                <Eye size={16} className="text-accent/60" />
                <span>{poem.views.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2" title="Likes">
                <Heart
                  size={16}
                  className={
                    isLiked ? "text-primary fill-primary" : "text-accent/60"
                  }
                />
                <span>{displayLikes.toLocaleString()}</span>
              </div>
            </div>
          </header>

          <div className="prose max-w-none mx-auto">
            <div className="urdu-text text-2xl md:text-3xl text-foreground/90 leading-[2.5] md:leading-[2.8] text-center whitespace-pre-wrap">
              {poem.content}
            </div>
          </div>

          <footer className="mt-20 pt-8 border-t border-accent/10 flex justify-between items-center">
            <div className="flex gap-4 relative">
              <Button
                variant="outline"
                size="icon"
                onClick={handleLike}
                title={isLiked ? "Unlike" : "Like"}
                className={`rounded-full border-accent/20 transition-all duration-300 ${isLiked ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20" : "text-accent hover:bg-accent hover:text-background hover:border-accent"}`}
              >
                <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                title="Share poem"
                onClick={handleShareClick}
                className="rounded-full border-accent/20 text-accent hover:bg-accent hover:text-background hover:border-accent transition-all"
              >
                <Share2 size={20} />
              </Button>
              <AnimatePresence>
                {shareOpen && (
                  <ShareMenu
                    title={poem.titleUrdu}
                    poetName={poem.poetNameUrdu}
                    onClose={() => setShareOpen(false)}
                  />
                )}
              </AnimatePresence>
            </div>
            <div className="font-heading tracking-widest text-xs uppercase text-muted-foreground">
              {poem.title} • {poem.poetName}
            </div>
          </footer>
        </motion.article>

        {/* ── Related Poems ── */}
        {relatedPoems.length > 0 && (
          <section className="mt-20">
            <div className="flex items-center gap-4 mb-10">
              <div className="flex-1 h-px bg-accent/10" />
              <div className="text-center">
                <p className="font-heading text-xs tracking-widest uppercase text-muted-foreground">
                  More by
                </p>
                <p className="font-urdu text-xl text-accent mt-1">
                  {poem.poetNameUrdu}
                </p>
              </div>
              <div className="flex-1 h-px bg-accent/10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedPoems.map((related, i) => (
                <PoemCard key={related.id} poem={related} index={i} />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href={`/poems?poetName=${encodeURIComponent(poem.poetName)}`}
                className="text-accent hover:text-accent/80 font-heading tracking-widest text-xs border-b border-accent/30 pb-1 inline-block transition-all hover:pr-3"
              >
                ALL POEMS BY {poem.poetName.toUpperCase()} &rarr;
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
