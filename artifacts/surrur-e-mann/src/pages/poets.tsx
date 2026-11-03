import { useListPoets } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { SectionHeading } from "@/components/section-heading";
import { useSeo } from "@/hooks/use-seo";

export default function Poets() {
  useSeo({
    title: "Urdu Poets: Ghalib, Iqbal, Faiz & More | شعراء",
    description: "Meet Urdu poets including Ghalib, Iqbal, Faiz and Mir. Explore their biographies and browse selected ghazals, nazms and other poetry.",
  });
  const { data: poetsData, isLoading: loadingPoets } = useListPoets();
  const poets = poetsData?.poets || [];

  return (
    <div className="w-full min-h-screen pb-24">
      <div className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <SectionHeading title="Poets" titleUrdu="شعراء" semanticLevel="h1" />
        <p className="font-urdu text-center text-lg md:text-xl text-muted-foreground -mt-8 mb-12 leading-relaxed">
          اردو کے نامور شعرا کا تعارف اور ان کا منتخب کلام ملاحظہ کریں۔
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {loadingPoets ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 bg-card border border-accent/10 rounded-xl animate-pulse" />
            ))
          ) : poets.length > 0 ? (
            poets.map((poet, i) => (
              <motion.div
                key={poet.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <Link href={`/poets/${poet.id}`} className="block h-full">
                  <div className="h-full flex flex-col items-center justify-center p-6 bg-background/50 border border-accent/20 hover:border-accent hover:bg-accent/5 rounded-xl transition-all duration-300 group">
                    <span className="font-urdu text-3xl text-foreground group-hover:text-accent mb-2 transition-colors">
                      {poet.nameUrdu}
                    </span>
                    <span className="font-heading text-xs tracking-widest uppercase text-muted-foreground group-hover:text-foreground transition-colors mb-4">
                      {poet.name}
                    </span>
                    <span className="text-xs text-accent/50 font-sans px-3 py-1 rounded-full bg-accent/5 border border-accent/10">
                      {poet.poemCount} POEMS
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground font-urdu text-xl">
              شعراء دستیاب نہیں ہیں
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
