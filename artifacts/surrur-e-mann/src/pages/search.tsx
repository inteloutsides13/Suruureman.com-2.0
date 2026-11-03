import { useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Search as SearchIcon } from "lucide-react";
import { useListPoems, getListPoemsQueryKey } from "@workspace/api-client-react";
import { PoemCard, PoemCardSkeleton } from "@/components/poem-card";
import { SectionHeading } from "@/components/section-heading";
import { useSeo } from "@/hooks/use-seo";
import { getPoemLanguageLabel } from "@/lib/poem-languages";

export default function Search() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(searchString);
  const initialQ = params.get("q") || "";

  const [inputValue, setInputValue] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);

  useSeo({
    title: debouncedQ ? `Search Urdu Poetry: ${debouncedQ}` : "Search Urdu Poems & Poets",
    description: debouncedQ
      ? `Search results for “${debouncedQ}” in the Surrur-e-Mann Urdu poetry library.`
      : "Search Urdu poems, poets and verses in the Surrur-e-Mann collection.",
    noindex: true,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(inputValue.trim());
      if (inputValue.trim()) {
        navigate(`/search?q=${encodeURIComponent(inputValue.trim())}`);
      } else {
        navigate("/search");
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

  const { data, isLoading } = useListPoems(
    debouncedQ ? { search: debouncedQ, limit: 50 } : {},
    { query: { enabled: !!debouncedQ, queryKey: getListPoemsQueryKey(debouncedQ ? { search: debouncedQ, limit: 50 } : {}) } }
  );

  const poems = data?.poems || [];

  return (
    <div className="w-full min-h-screen pb-24">
      <div className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <SectionHeading title="Search Urdu Poetry" titleUrdu="تلاش" semanticLevel="h1" />

        <div className="max-w-2xl mx-auto mt-8 mb-16 relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon size={18} className="text-accent/60" />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search poems, poets, verses…"
            autoFocus
            className="w-full bg-card/40 border border-accent/20 hover:border-accent/40 focus:border-accent focus:outline-none rounded-full py-3 pl-11 pr-5 text-foreground placeholder:text-muted-foreground/40 font-sans text-sm tracking-wide transition-colors duration-300"
          />
        </div>

        {!debouncedQ && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <SearchIcon size={40} className="text-accent/20 mb-4" />
            <p className="font-urdu text-2xl text-muted-foreground">جو ڈھونڈتے ہو وہ لکھو</p>
            <p className="font-heading text-xs text-muted-foreground/40 tracking-widest uppercase mt-2">
              Type above to search
            </p>
          </div>
        )}

        {debouncedQ && (
          <>
            {!isLoading && (
              <p className="text-center font-heading text-xs text-muted-foreground/40 tracking-widest uppercase mb-10">
                {poems.length} result{poems.length !== 1 ? "s" : ""} for &ldquo;{debouncedQ}&rdquo;
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <PoemCardSkeleton key={i} />)
              ) : poems.length > 0 ? (
                poems.map((poem, i) => (
                  <div key={poem.id} className="relative">
                    <PoemCard poem={poem} index={i} />
                    {poem.language && poem.language !== "urdu" && (
                      <div className="absolute top-3 right-3 z-10 pointer-events-none">
                        <span className="text-[10px] font-heading tracking-widest uppercase px-2 py-0.5 rounded-full bg-background/90 border border-accent/30 text-accent backdrop-blur-sm">
                          {getPoemLanguageLabel(poem.language)}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-24 text-center border border-dashed border-accent/20 rounded-3xl bg-card/20">
                  <p className="font-urdu text-3xl text-foreground mb-4">کوئی نتیجہ نہیں ملا</p>
                  <p className="font-heading text-muted-foreground tracking-widest uppercase text-sm">
                    No poems matched your search
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
