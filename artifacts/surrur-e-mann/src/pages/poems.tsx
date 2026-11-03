import { useState, useEffect } from "react";
import { useListPoems, useListCategories } from "@workspace/api-client-react";
import { type Poem } from "@workspace/api-client-react";
import { PoemCard, PoemCardSkeleton } from "@/components/poem-card";
import { SectionHeading } from "@/components/section-heading";
import { motion } from "framer-motion";
import { useSeo } from "@/hooks/use-seo";
import { useLocation, useSearch } from "wouter";

const PAGE_SIZE = 6;

export default function Poems() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const activeCategory = new URLSearchParams(search).get("category") || undefined;
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [allPoems, setAllPoems] = useState<Poem[]>([]);

  const { data: poemsData, isLoading: loadingPoems, isFetching } = useListPoems({ category: activeCategory, limit, offset: 0 });
  const { data: categoriesData, isLoading: loadingCategories } = useListCategories();

  const total = poemsData?.total ?? 0;
  const categories = categoriesData?.categories || [];
  const hasMore = allPoems.length < total;
  const categoryLabel = activeCategory
    ? categories.find((category) => category.slug === activeCategory)?.name ?? activeCategory.replace(/-/g, " ")
    : undefined;

  useSeo({
    title: categoryLabel
      ? `${categoryLabel} Poetry | Urdu Collection`
      : "Urdu Poetry: Ghazals, Nazms & Classical Verse",
    description: categoryLabel
      ? `Read ${categoryLabel} in the Surrur-e-Mann Urdu poetry collection, alongside ghazals, nazms, and classical verse.`
      : "Read Urdu ghazals, nazms, qasidas and classical verse. Browse poems by poet or literary form in the Surrur-e-Mann collection.",
  });

  useEffect(() => {
    if (poemsData?.poems) {
      setAllPoems(poemsData.poems);
    }
  }, [poemsData?.poems]);

  function handleCategoryChange(slug: string | undefined) {
    if (slug === activeCategory) return;
    const query = slug ? `?${new URLSearchParams({ category: slug }).toString()}` : "";
    setLocation(`/poems${query}`);
    setLimit(PAGE_SIZE);
    setAllPoems([]);
  }

  function handleLoadMore() {
    setLimit((prev) => prev + PAGE_SIZE);
  }

  return (
    <div className="w-full min-h-screen pb-24">
      <div className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <SectionHeading
          title="The Collection"
          titleUrdu="مجموعہ کلام"
          semanticLevel="h1"
        />
        <p className="font-urdu text-center text-lg md:text-xl text-muted-foreground -mt-8 mb-12 leading-relaxed">
          یہاں غزل، نظم اور دیگر اصناف کا منتخب اردو کلام پڑھیں۔
        </p>

        <div className="flex flex-wrap justify-center gap-3 mt-8 mb-16">
          <button
            onClick={() => handleCategoryChange(undefined)}
            className={`px-6 py-2 rounded-full border transition-all duration-300 font-urdu text-lg ${
              activeCategory === undefined
                ? "bg-accent border-accent text-background shadow-[0_0_15px_rgba(201,168,76,0.3)]"
                : "bg-transparent border-accent/30 text-foreground hover:border-accent hover:text-accent"
            }`}
          >
            تمام (All)
          </button>

          {!loadingCategories && categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.slug)}
              className={`px-6 py-2 rounded-full border transition-all duration-300 font-urdu text-lg ${
                activeCategory === cat.slug
                  ? "bg-accent border-accent text-background shadow-[0_0_15px_rgba(201,168,76,0.3)]"
                  : "bg-transparent border-accent/30 text-foreground hover:border-accent hover:text-accent"
              }`}
            >
              {cat.nameUrdu}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loadingPoems && allPoems.length === 0 ? (
            Array.from({ length: PAGE_SIZE }).map((_, i) => <PoemCardSkeleton key={i} />)
          ) : allPoems.length > 0 ? (
            allPoems.map((poem, i) => (
              <PoemCard key={poem.id} poem={poem} index={i} />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="col-span-full py-24 flex flex-col items-center justify-center text-center border border-dashed border-accent/20 rounded-3xl bg-card/20"
            >
              <div className="w-16 h-16 rounded-full bg-accent/5 flex items-center justify-center mb-6">
                <span className="text-2xl text-accent/50">!</span>
              </div>
              <h3 className="font-urdu text-3xl text-foreground mb-4">اس زمرے میں کوئی اشعار نہیں ہیں</h3>
              <p className="font-heading text-muted-foreground tracking-widest uppercase text-sm">
                No poems found in this category
              </p>
            </motion.div>
          )}

          {isFetching && allPoems.length > 0 &&
            Array.from({ length: 3 }).map((_, i) => <PoemCardSkeleton key={`more-${i}`} />)
          }
        </div>

        {hasMore && !loadingPoems && (
          <div className="mt-16 flex justify-center">
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
  );
}
