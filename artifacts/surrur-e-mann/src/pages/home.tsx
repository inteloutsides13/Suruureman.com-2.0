import { useState } from "react";
import { useGetDailyPoem, useListPoems, useListCategories, useListVideos } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Play, Flame } from "lucide-react";
import { Link } from "wouter";
import { PoemCard, PoemCardSkeleton } from "@/components/poem-card";
import { SectionHeading } from "@/components/section-heading";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSeo } from "@/hooks/use-seo";
import { getPoemLanguage } from "@/lib/poem-languages";
import { SocialLinks } from "@/components/social-links";

export default function Home() {
  useSeo({
    title: "Urdu Poetry & Ghazals | سُرُورِ مَن",
    description: "Read Urdu ghazals, nazms and classical verse at Surrur-e-Mann. Explore poets, a daily poem, and thoughtful Urdu recitations.",
    ogTitle: "Surrur-e-Mann | Urdu Poetry, Ghazals & Nazms",
  });
  const [selectedYoutubeId, setSelectedYoutubeId] = useState<string | null>(null);

  const { data: dailyPoemData, isLoading: loadingDailyPoem, isError: dailyPoemError } = useGetDailyPoem();
  const { data: featuredData, isLoading: loadingFeatured } = useListPoems({ featured: true, limit: 3 });
  const { data: latestData, isLoading: loadingLatest } = useListPoems({ sort: "latest", limit: 4 });
  const { data: popularData, isLoading: loadingPopular } = useListPoems({ sort: "popular", limit: 6 });
  const { data: categoriesData, isLoading: loadingCategories } = useListCategories();
  const { data: videosData, isLoading: loadingVideos } = useListVideos();
  const { data: urduData, isLoading: loadingUrdu } = useListPoems({ language: "urdu", limit: 6 });
  const { data: punjabiData, isLoading: loadingPunjabi } = useListPoems({ language: "punjabi", limit: 6 });
  const { data: arabicData, isLoading: loadingArabic } = useListPoems({ language: "arabic", limit: 6 });
  const { data: persianData, isLoading: loadingPersian } = useListPoems({ language: "persian", limit: 6 });
  const { data: englishData, isLoading: loadingEnglish } = useListPoems({ language: "english", limit: 6 });
  const { data: spanishData, isLoading: loadingSpanish } = useListPoems({ language: "spanish", limit: 6 });
  const { data: punjabiShahmukhiData, isLoading: loadingPunjabiShahmukhi } = useListPoems({ language: "punjabi-shahmukhi", limit: 6 });

  const featuredPoems = featuredData?.poems || [];
  const latestPoems = latestData?.poems || [];
  const popularPoems = popularData?.poems || [];
  const categories = categoriesData?.categories || [];
  const videos = videosData?.videos || [];
  const urduPoems = urduData?.poems || [];
  const punjabiPoems = punjabiData?.poems || [];
  const arabicPoems = arabicData?.poems || [];
  const persianPoems = persianData?.poems || [];

  return (
    <div className="w-full">
      {/* 1. HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(352_73%_36%_/_0.15),_hsl(340_25%_4%_/_1)_60%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center px-4 w-full max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-accent/20 blur-[100px] rounded-full" />
            <img
              src={`${import.meta.env.BASE_URL}logo.jpg`}
              alt="Surrur-e-Mann"
              fetchPriority="high"
              className="w-64 md:w-80 lg:w-96 rounded-3xl shadow-[0_0_50px_rgba(201,168,76,0.15)] border-2 border-accent/20 relative z-10"
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="font-urdu text-4xl md:text-5xl lg:text-6xl text-accent mt-12 text-center text-glow-gold leading-relaxed"
          >
            اردو شاعری، ہر لفظ میں ایک کیفیت
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="font-heading text-muted-foreground uppercase tracking-[0.4em] mt-4 text-sm"
          >
            The State Within Every Word
          </motion.p>

          <SocialLinks className="mt-8" />
        </div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50"
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <div className="w-[1px] h-12 bg-gradient-to-b from-accent to-transparent" />
        </motion.div>
      </section>

      {/* 2. DAILY POEM */}
      <section id="daily-poem" className="py-20 md:py-24 bg-background relative border-t border-accent/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Daily Poem" titleUrdu="آج کا شعر" />
          <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-[radial-gradient(ellipse_at_top,_hsl(352_73%_36%_/_0.16),_transparent_65%)] px-5 py-8 sm:px-10 md:px-14 md:py-12">
            <div aria-hidden="true" className="absolute inset-3 rounded-xl border border-primary/20 pointer-events-none" />
            <div aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
            <div className="relative min-h-36 flex flex-col items-center justify-center text-center" dir="rtl">
              {loadingDailyPoem ? (
                <p className="font-urdu text-lg text-muted-foreground" role="status">آج کا شعر لوڈ ہو رہا ہے…</p>
              ) : dailyPoemError ? (
                <p className="font-urdu text-lg text-muted-foreground" role="status">آج کا شعر فی الحال دستیاب نہیں۔</p>
              ) : dailyPoemData?.poem ? (
                <>
                  <div className="space-y-2 sm:space-y-3">
                    {dailyPoemData.poem.lines.map((line, index) => (
                      <p key={`${dailyPoemData.poem?.id}-${index}`} className="font-urdu text-xl leading-relaxed text-foreground/95 sm:text-2xl md:text-3xl">
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="mt-7 flex flex-col items-center gap-3">
                    <p className="font-urdu text-base text-accent/80">{dailyPoemData.poem.poetNameUrdu}</p>
                    <Link
                      href={`/poems/${dailyPoemData.poem.id}`}
                      className="inline-flex min-h-10 items-center rounded-full border border-accent/35 px-5 text-sm text-accent transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      مکمل کلام پڑھیے
                    </Link>
                  </div>
                </>
              ) : (
                <p className="font-urdu text-lg text-muted-foreground" role="status">آج کا شعر دستیاب نہیں ہے۔</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. LATEST POEMS */}
      <section className="py-24 bg-card/20 border-t border-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Latest Works" titleUrdu="تازہ کلام" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingLatest
              ? Array.from({ length: 4 }).map((_, i) => <PoemCardSkeleton key={i} />)
              : latestPoems.length > 0
                ? latestPoems.map((poem, i) => <PoemCard key={poem.id} poem={poem} index={i} />)
                : <div className="col-span-full text-center py-12 text-muted-foreground font-urdu text-xl">اشعار دستیاب نہیں ہیں</div>
            }
          </div>
          <div className="mt-16 flex justify-center">
            <Link href="/poems" className="px-8 py-3 rounded-full border border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground transition-all duration-300 font-heading tracking-widest text-sm shadow-[0_0_20px_rgba(201,168,76,0.1)]">
              Browse All Poetry
            </Link>
          </div>
        </div>
      </section>

      {/* 4. POPULAR / TRENDING */}
      <section className="py-24 relative overflow-hidden bg-card/10 border-t border-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end gap-4 mb-12">
            <SectionHeading title="Popular Now" titleUrdu="مقبول کلام" />
            <Flame size={20} className="text-primary mb-2 animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingPopular
              ? Array.from({ length: 6 }).map((_, i) => <PoemCardSkeleton key={i} />)
              : popularPoems.length > 0
                ? popularPoems.map((poem, i) => (
                    <div key={poem.id} className="relative">
                      <PoemCard poem={poem} index={i} />
                      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 border border-accent/20">
                        <span className="font-heading text-[10px] tracking-widest uppercase text-accent">#{i + 1}</span>
                      </div>
                    </div>
                  ))
                : <div className="col-span-full text-center py-12 text-muted-foreground font-urdu text-xl">اشعار دستیاب نہیں ہیں</div>
            }
          </div>

          <div className="mt-12 flex justify-center">
            <Link href="/poems" className="px-8 py-3 rounded-full border border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground transition-all duration-300 font-heading tracking-widest text-sm shadow-[0_0_20px_rgba(201,168,76,0.1)]">
              Browse Full Collection
            </Link>
          </div>
        </div>
      </section>

      {/* 4. VISUAL POETRY */}
      <section className="py-24 relative overflow-hidden border-t border-accent/5">
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/visual-poetry-1.png`}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-20 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <SectionHeading title="Visual Experience" titleUrdu="تصویری شاعری" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {featuredPoems.slice(0, 2).map((poem, i) => (
              <motion.div
                key={`visual-${poem.id}`}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden group cursor-pointer"
              >
                <img
                  src={`${import.meta.env.BASE_URL}images/visual-poetry-${(i % 2) + 1}.png`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="absolute inset-0 border-2 border-accent/20 rounded-2xl m-4 pointer-events-none" />
                <div className="absolute bottom-0 inset-x-0 p-8 md:p-12 flex flex-col justify-end">
                  <h3 className="urdu-text text-3xl md:text-4xl font-bold text-foreground mb-4 text-glow-crimson group-hover:text-accent transition-colors duration-500">
                    {poem.titleUrdu}
                  </h3>
                  <p className="urdu-text text-xl md:text-2xl text-foreground/80 line-clamp-2 mb-6">
                    {poem.content.split("\n")[0]}
                  </p>
                  <div className="flex justify-end">
                    <span className="font-heading tracking-widest text-accent text-sm border-b border-accent/30 pb-1 inline-block">READ MORE</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CATEGORIES */}
      <section className="py-24 bg-card/30 border-y border-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Forms & Genres" titleUrdu="اصنافِ سخن" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {loadingCategories
              ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-32 bg-card border border-accent/10 rounded-xl animate-pulse" />)
              : categories.map((category, i) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <Link href={`/poems?category=${category.slug}`} className="block h-full">
                      <div className="h-full flex flex-col items-center justify-center p-6 bg-background/50 border border-accent/20 hover:border-accent hover:bg-accent/5 rounded-xl transition-all duration-300 group">
                        <span className="font-urdu text-3xl text-foreground group-hover:text-accent mb-2 transition-colors">{category.nameUrdu}</span>
                        <span className="font-heading text-xs tracking-widest uppercase text-muted-foreground group-hover:text-foreground transition-colors mb-4">{category.name}</span>
                        <span className="text-xs text-accent/50 font-sans px-3 py-1 rounded-full bg-accent/5 border border-accent/10">{category.poemCount} POEMS</span>
                      </div>
                    </Link>
                  </motion.div>
                ))
            }
          </div>
        </div>
      </section>

      {/* 5b. BROWSE BY LANGUAGE */}
      <section className="py-20 bg-background border-t border-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Browse by Language" titleUrdu="زبان کے مطابق" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-10">
            {[
              { option: getPoemLanguage("urdu")!, total: urduData?.total, loading: loadingUrdu },
              { option: getPoemLanguage("punjabi")!, total: punjabiData?.total, loading: loadingPunjabi },
              { option: getPoemLanguage("arabic")!, total: arabicData?.total, loading: loadingArabic },
              { option: getPoemLanguage("persian")!, total: persianData?.total, loading: loadingPersian },
              { option: getPoemLanguage("english")!, total: englishData?.total, loading: loadingEnglish },
              { option: getPoemLanguage("spanish")!, total: spanishData?.total, loading: loadingSpanish },
              { option: getPoemLanguage("punjabi-shahmukhi")!, total: punjabiShahmukhiData?.total, loading: loadingPunjabiShahmukhi },
            ].map((item, i) => (
              <motion.div
                key={item.option.value}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <Link href={`/poetry/${item.option.value}`} className="block h-full group">
                  <div className="h-full flex flex-col items-center justify-center p-6 md:p-8 bg-card/40 border border-accent/15 hover:border-accent hover:bg-accent/5 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(201,168,76,0.08)] min-h-[160px] text-center">
                    <span className="font-urdu text-3xl md:text-4xl text-foreground group-hover:text-accent mb-3 transition-colors duration-300 leading-normal">
                      {item.option.titleUrdu}
                    </span>
                    <span className="font-heading text-[10px] md:text-xs tracking-widest uppercase text-muted-foreground group-hover:text-foreground/70 transition-colors mb-4">
                      {item.option.title}
                    </span>
                    <span className={`text-xs font-heading px-3 py-1 rounded-full border transition-all duration-300 ${
                      item.loading
                        ? "bg-accent/5 border-accent/10 text-accent/30 animate-pulse w-16"
                        : (item.total ?? 0) > 0
                          ? "bg-accent/10 border-accent/20 text-accent group-hover:bg-accent group-hover:text-background"
                          : "bg-card/50 border-accent/10 text-muted-foreground/40"
                    }`}>
                      {item.loading ? "\u00A0" : (item.total ?? 0) > 0 ? `${item.total} POEMS` : "COMING SOON"}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. VIDEOS */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Recitations" titleUrdu="ویڈیوز" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingVideos
              ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="aspect-video bg-card border border-accent/10 rounded-2xl animate-pulse" />)
              : videos.length > 0
                ? videos.slice(0, 3).map((video, i) => (
                    <motion.div
                      key={video.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="group cursor-pointer"
                      onClick={() => setSelectedYoutubeId(video.youtubeId)}
                    >
                      <div className="relative aspect-video rounded-2xl overflow-hidden border border-accent/20 mb-4 shadow-lg shadow-black/50">
                        <img
                          loading="lazy"
                          decoding="async"
                          src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`}
                        alt={video.titleUrdu || video.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-primary/20 mix-blend-multiply transition-opacity group-hover:opacity-0" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-background/80 backdrop-blur-sm border border-accent flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-background transition-all duration-300 shadow-[0_0_20px_rgba(201,168,76,0.3)] group-hover:shadow-[0_0_30px_rgba(201,168,76,0.6)] group-hover:scale-110">
                            <Play className="ml-1" fill="currentColor" size={24} />
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded font-sans font-medium border border-accent/20">
                          {video.duration}
                        </div>
                      </div>
                      <h4 className="urdu-text text-xl font-bold text-foreground group-hover:text-accent transition-colors">{video.titleUrdu}</h4>
                      <p className="urdu-text text-muted-foreground text-sm mt-2 line-clamp-2">{video.description}</p>
                    </motion.div>
                  ))
                : <div className="col-span-full text-center py-12 text-muted-foreground font-urdu text-xl">ویڈیوز دستیاب نہیں ہیں</div>
            }
          </div>
          <div className="mt-12 text-center">
            <Link href="/videos" className="text-accent hover:text-accent/80 font-heading tracking-widest text-sm border-b border-accent pb-1 inline-block transition-all hover:pr-4">
              VIEW ALL VIDEOS &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* 8. URDU POETRY */}
      <section className="py-24 bg-background relative border-t border-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Urdu Poetry" titleUrdu="اردو شاعری" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingUrdu
              ? Array.from({ length: 6 }).map((_, i) => <PoemCardSkeleton key={i} />)
              : urduPoems.length > 0
                ? urduPoems.map((poem, i) => <PoemCard key={poem.id} poem={poem} index={i} />)
                : <div className="col-span-full text-center py-12 text-muted-foreground font-urdu text-xl">اشعار دستیاب نہیں ہیں</div>
            }
          </div>
          <div className="mt-12 flex justify-center">
            <Link href="/poetry/urdu" className="px-8 py-3 rounded-full border border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground transition-all duration-300 font-heading tracking-widest text-sm shadow-[0_0_20px_rgba(201,168,76,0.1)]">
              Browse All Urdu Poetry {urduData?.total ? `(${urduData.total})` : ""}
            </Link>
          </div>
        </div>
      </section>

      {/* 9. PUNJABI POETRY */}
      <section className="py-24 bg-card/20 relative border-t border-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Punjabi Poetry" titleUrdu="پنجابی شاعری" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingPunjabi
              ? Array.from({ length: 6 }).map((_, i) => <PoemCardSkeleton key={i} />)
              : punjabiPoems.length > 0
                ? punjabiPoems.map((poem, i) => <PoemCard key={poem.id} poem={poem} index={i} />)
                : (
                  <motion.div
                    className="col-span-full flex flex-col items-center justify-center py-16 gap-4"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                  >
                    <p className="font-urdu text-2xl text-muted-foreground">جلد آ رہا ہے</p>
                    <p className="font-heading text-xs tracking-widest uppercase text-muted-foreground/50">Coming Soon</p>
                  </motion.div>
                )
            }
          </div>
          <div className="mt-12 flex justify-center">
            <Link href="/poetry/punjabi" className="px-8 py-3 rounded-full border border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground transition-all duration-300 font-heading tracking-widest text-sm shadow-[0_0_20px_rgba(201,168,76,0.1)]">
              Browse Punjabi Poetry {punjabiData?.total ? `(${punjabiData.total})` : ""}
            </Link>
          </div>
        </div>
      </section>

      {/* 10. ARABIC POETRY */}
      <section className="py-24 bg-background relative border-t border-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Arabic Poetry" titleUrdu="عربی شاعری" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingArabic
              ? Array.from({ length: 6 }).map((_, i) => <PoemCardSkeleton key={i} />)
              : arabicPoems.length > 0
                ? arabicPoems.map((poem, i) => <PoemCard key={poem.id} poem={poem} index={i} />)
                : (
                  <motion.div
                    className="col-span-full flex flex-col items-center justify-center py-16 gap-4"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                  >
                    <p className="font-urdu text-2xl text-muted-foreground">قریب ہے</p>
                    <p className="font-heading text-xs tracking-widest uppercase text-muted-foreground/50">Coming Soon</p>
                  </motion.div>
                )
            }
          </div>
          <div className="mt-12 flex justify-center">
            <Link href="/poetry/arabic" className="px-8 py-3 rounded-full border border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground transition-all duration-300 font-heading tracking-widest text-sm shadow-[0_0_20px_rgba(201,168,76,0.1)]">
              Browse Arabic Poetry {arabicData?.total ? `(${arabicData.total})` : ""}
            </Link>
          </div>
        </div>
      </section>

      {/* 11. PERSIAN POETRY */}
      <section className="py-24 bg-card/20 relative border-t border-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Persian Poetry" titleUrdu="فارسی شاعری" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingPersian
              ? Array.from({ length: 6 }).map((_, i) => <PoemCardSkeleton key={i} />)
              : persianPoems.length > 0
                ? persianPoems.map((poem, i) => <PoemCard key={poem.id} poem={poem} index={i} />)
                : (
                  <motion.div
                    className="col-span-full flex flex-col items-center justify-center py-16 gap-4"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                  >
                    <p className="font-urdu text-2xl text-muted-foreground">عنقریب</p>
                    <p className="font-heading text-xs tracking-widest uppercase text-muted-foreground/50">Coming Soon</p>
                  </motion.div>
                )
            }
          </div>
          <div className="mt-12 flex justify-center">
            <Link href="/poetry/persian" className="px-8 py-3 rounded-full border border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground transition-all duration-300 font-heading tracking-widest text-sm shadow-[0_0_20px_rgba(201,168,76,0.1)]">
              Browse Persian Poetry {persianData?.total ? `(${persianData.total})` : ""}
            </Link>
          </div>
        </div>
      </section>

      <Dialog open={!!selectedYoutubeId} onOpenChange={(open) => { if (!open) setSelectedYoutubeId(null); }}>
        <DialogContent className="max-w-3xl w-full border-accent/20 bg-background p-2">
          <div className="aspect-video w-full">
            {selectedYoutubeId && (
              <iframe
                src={`https://www.youtube.com/embed/${selectedYoutubeId}?autoplay=1`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full h-full rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
