import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useListPoems, useListCategories, type Poem } from "@workspace/api-client-react";
import { PoemCard, PoemCardSkeleton } from "@/components/poem-card";
import { SectionHeading } from "@/components/section-heading";
import { motion } from "framer-motion";
import { useSeo } from "@/hooks/use-seo";
import { getPoemLanguage, POEM_LANGUAGES } from "@/lib/poem-languages";

const PAGE_SIZE = 6;

export default function LanguagePoems() {
  const { language } = useParams<{ language: string }>();
  const meta = getPoemLanguage(language ?? "") ?? getPoemLanguage("urdu")!;
  const lang = meta.value;

  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [allPoems, setAllPoems] = useState<Poem[]>([]);

  useSeo({
    title: `${meta.title} | ${meta.titleUrdu}`,
    description: meta.description,
  });

  const { data: poemsData, isLoading: loadingPoems, isFetching } = useListPoems({
    language: lang,
    category: activeCategory,
    limit,
    offset: 0,
  });
  const { data: categoriesData } = useListCategories();

  const total = poemsData?.total ?? 0;
  const categories = categoriesData?.categories ?? [];
  const hasMore = allPoems.length < total;

  useEffect(() => {
    if (poemsData?.poems) setAllPoems(poemsData.poems);
  }, [poemsData?.poems]);

  useEffect(() => {
    setActiveCategory(undefined);
    setLimit(PAGE_SIZE);
    setAllPoems([]);
  }, [lang]);

  function handleCategoryChange(slug: string | undefined) {
    setActiveCategory(slug);
    setLimit(PAGE_SIZE);
    setAllPoems([]);
  }

  const otherLanguages = POEM_LANGUAGES.filter((item) => item.value !== lang);

  return (
    <div className="w-full min-h-screen pb-24">
      <div className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <SectionHeading
          title={meta.title}
          titleUrdu={meta.titleUrdu}
          semanticLevel="h1"
        />
        {lang === "urdu" && (
          <p className="font-urdu text-center text-lg md:text-xl text-muted-foreground -mt-8 mb-12 leading-relaxed">
            اردو زبان کے شعرا کا منتخب کلام پڑھیں اور اپنی پسند کی صنف تلاش کریں۔
          </p>
        )}

        {!loadingPoems && total > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center font-heading text-xs text-muted-foreground/50 tracking-widest uppercase mt-2 mb-4"
          >
            {total} Poem{total !== 1 ? "s" : ""}
          </motion.p>
        )}

        {/* Other language quick-nav */}
        <div className="flex flex-wrap justify-center gap-3 mt-6 mb-8">
          {otherLanguages.map((item) => (
            <Link
              key={item.value}
              href={`/poetry/${item.value}`}
              className="px-4 py-1.5 rounded-full border border-accent/20 text-muted-foreground hover:border-accent hover:text-accent text-xs font-heading tracking-widest uppercase transition-all duration-300"
            >
              {item.title}
            </Link>
          ))}
        </div>

        {/* Category sub-filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
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
          {categories.map((cat) => (
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
            allPoems.map((poem, i) => <PoemCard key={poem.id} poem={poem} index={i} />)
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-24 flex flex-col items-center justify-center text-center border border-dashed border-accent/20 rounded-3xl bg-card/20"
            >
              <div className="w-16 h-16 rounded-full bg-accent/5 flex items-center justify-center mb-6">
                <span className="font-urdu text-2xl text-accent/30">شعر</span>
              </div>
              <p className="font-urdu text-3xl text-muted-foreground mb-4">{meta.noPoems}</p>
              <p className="font-heading text-muted-foreground/50 tracking-widest uppercase text-sm">
                {meta.comingSoon}
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
              onClick={() => setLimit((p) => p + PAGE_SIZE)}
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
