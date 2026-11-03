import { useState } from "react";
import { useListVideos } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSeo } from "@/hooks/use-seo";

export default function Videos() {
  useSeo({
    title: "Urdu Poetry Recitations & Videos | کلام",
    description: "Watch and listen to Urdu poetry recitations, with videos featuring classical verse and poets from the Surrur-e-Mann collection.",
  });
  const { data: videosData, isLoading: loadingVideos } = useListVideos();
  const [selectedYoutubeId, setSelectedYoutubeId] = useState<string | null>(null);

  const videos = videosData?.videos || [];

  return (
    <div className="w-full min-h-screen pb-24">
      <div className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <SectionHeading title="Recitations" titleUrdu="ویڈیوز" semanticLevel="h1" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loadingVideos ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video bg-card border border-accent/10 rounded-2xl animate-pulse" />
            ))
          ) : videos.length > 0 ? (
            videos.map((video, i) => (
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
                    src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`}
                    alt={video.titleUrdu || video.title}
                    loading="lazy"
                    decoding="async"
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
                <h4 className="urdu-text text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                  {video.titleUrdu}
                </h4>
                <p className="urdu-text text-muted-foreground text-sm mt-2 line-clamp-2">
                  {video.description}
                </p>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground font-urdu text-xl">
              ویڈیوز دستیاب نہیں ہیں
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedYoutubeId} onOpenChange={(open) => { if (!open) setSelectedYoutubeId(null); }}>
        <DialogContent className="max-w-3xl w-full border-accent/20 bg-background p-2">
          <DialogTitle className="sr-only">Video Player</DialogTitle>
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
