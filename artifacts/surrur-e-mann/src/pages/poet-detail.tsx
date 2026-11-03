import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetPoet, useListPoems, getListPoemsQueryKey } from "@workspace/api-client-react";
import { type Poem } from "@workspace/api-client-react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { PoemCard, PoemCardSkeleton } from "@/components/poem-card";
import { SectionHeading } from "@/components/section-heading";
import { SITE_ORIGIN, truncateMetaDescription, useSeo } from "@/hooks/use-seo";
import { BreadcrumbJsonLd } from "@/components/breadcrumb-json-ld";
import { PersonJsonLd } from "@/components/person-json-ld";

const PAGE_SIZE = 12;

export default function PoetDetail() {
  const { id } = useParams<{ id: string }>();
  const poetId = parseInt(id || "0", 10);

  const [poemLimit, setPoemLimit] = useState(PAGE_SIZE);
  const [allPoems, setAllPoems] = useState<Poem[]>([]);

  const { data: poet, isLoading: loadingPoet, isError } = useGetPoet(poetId);
  const { data: poemsData, isLoading: loadingPoems, isFetching } = useListPoems(
    poet ? { poetName: poet.name, limit: poemLimit, offset: 0 } : undefined,
    { query: { enabled: !!poet, queryKey: getListPoemsQueryKey(poet ? { poetName: poet.name, limit: poemLimit, offset: 0 } : undefined) } }
  );

  const total = poemsData?.total ?? 0;
  const hasMore = allPoems.length < total;

  useEffect(() => {
    if (poemsData?.poems) {
      setAllPoems(poemsData.poems);
    }
  }, [poemsData?.poems]);

  // Reset when poet changes
  useEffect(() => {
    setPoemLimit(PAGE_SIZE);
    setAllPoems([]);
  }, [poetId]);

  function handleLoadMore() {
    setPoemLimit((prev) => prev + PAGE_SIZE);
  }

  useSeo({
    title: poet
      ? `${[poet.name, poet.nameUrdu].filter(Boolean).join(" | ")} — Urdu Poet`
      : undefined,
    description: poet
      ? truncateMetaDescription(
          `Discover ${poet.name}${poet.nameUrdu ? ` (${poet.nameUrdu})` : ""}, an Urdu poet${
            poet.era ? ` from ${poet.era}` : ""
          }. ${poet.bio}`.replace(/\s+/g, " "),
        )
      : undefined,
    ogTitle: poet ? `${poet.name} — Urdu Poet | ${poet.nameUrdu}` : undefined,
    ogDescription: poet
      ? truncateMetaDescription(
          poet.bio ? `${poet.name}. ${poet.bio}` : `Explore the profile of Urdu poet ${poet.name}.`,
        )
      : undefined,
    noindex: !loadingPoet && (isError || !poet),
  });

  if (loadingPoet) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(201,168,76,0.3)]" />
        <p className="mt-8 font-urdu text-2xl text-accent animate-pulse">انتظار فرمائیں...</p>
      </div>
    );
  }

  if (isError || !poet) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 min-h-[80vh] flex flex-col items-center justify-center text-center">
        <h2 className="font-urdu text-4xl text-destructive mb-4">شاعر نہیں ملا</h2>
        <p className="font-heading text-muted-foreground tracking-widest uppercase text-sm">
          Poet Not Found
        </p>
      </div>
    );
  }

  return (
    <div className="w-full relative min-h-screen">
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(352_73%_36%_/_0.05),_hsl(340_25%_4%_/_1)_70%)]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <BreadcrumbJsonLd
          items={[
            { name: "Home", href: "/" },
            { name: "Poets", href: "/poets" },
            { name: poet.name, href: `/poets/${poet.id}` },
          ]}
        />
        <PersonJsonLd
          name={poet.name}
          alternateName={poet.nameUrdu || undefined}
          description={poet.bio || undefined}
          url={`${SITE_ORIGIN}/poets/${poet.id}`}
        />
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-10 text-xs font-heading tracking-widest uppercase text-muted-foreground">
          <Link href="/" className="hover:text-accent transition-colors">Home</Link>
          <ChevronRight size={12} className="opacity-40" />
          <Link href="/poets" className="hover:text-accent transition-colors">Poets</Link>
          <ChevronRight size={12} className="opacity-40" />
          <span className="text-accent truncate max-w-[160px]">{poet?.name}</span>
        </nav>

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
            <span className="inline-block px-4 py-1 rounded-full bg-accent/5 border border-accent/20 text-accent font-heading text-xs tracking-widest uppercase mb-6">
              {poet.era}
            </span>
            <h1 className="urdu-text text-center text-4xl md:text-5xl lg:text-6xl font-bold text-foreground text-glow-gold mb-4 leading-[1.8] !tracking-normal">
              {poet.nameUrdu}
            </h1>
            <p className="font-heading text-lg text-muted-foreground tracking-widest uppercase">
              {poet.name}
            </p>
            <div className="mt-6">
              <span className="text-xs text-accent/50 font-sans px-4 py-2 rounded-full bg-accent/5 border border-accent/10">
                {poet.poemCount} POEMS
              </span>
            </div>
          </header>

          <div className="prose max-w-none mx-auto mb-12">
            <div className="urdu-text text-xl md:text-2xl text-foreground/90 leading-[2.5] text-right mb-8">
              {poet.bioUrdu}
            </div>
            <div className="text-base text-muted-foreground leading-relaxed text-left border-t border-accent/10 pt-8">
              {poet.bio}
            </div>
          </div>
        </motion.article>

        <div className="mt-16">
          <SectionHeading title="Their Poetry" titleUrdu="کلام" />

          {total > 0 && (
            <p className="text-center text-xs text-muted-foreground font-heading tracking-widest uppercase mb-8">
              Showing {allPoems.length} of {total} poems
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingPoems && allPoems.length === 0 ? (
              Array.from({ length: PAGE_SIZE }).map((_, i) => <PoemCardSkeleton key={i} />)
            ) : allPoems.length > 0 ? (
              allPoems.map((poem, i) => (
                <PoemCard key={poem.id} poem={poem} index={i} />
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground font-urdu text-xl">
                اشعار دستیاب نہیں ہیں
              </div>
            )}

            {isFetching && allPoems.length > 0 &&
              Array.from({ length: 4 }).map((_, i) => <PoemCardSkeleton key={`more-${i}`} />)
            }
          </div>

          {hasMore && !loadingPoems && (
            <div className="mt-12 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={isFetching}
                className="px-8 py-3 rounded-full border border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-heading tracking-widest text-sm shadow-[0_0_20px_rgba(201,168,76,0.1)]"
              >
                {isFetching ? "Loading..." : `Load More (${total - allPoems.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
