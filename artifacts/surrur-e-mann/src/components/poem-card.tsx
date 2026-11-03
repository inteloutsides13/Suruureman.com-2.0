import { motion } from "framer-motion";
import { Link } from "wouter";
import { type Poem } from "@workspace/api-client-react";

interface PoemCardProps {
  poem: Poem;
  index?: number;
  featured?: boolean;
}

export function PoemCard({ poem, index = 0, featured = false }: PoemCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <Link href={`/poems/${poem.id}`} className="block h-full">
        <div className={`
          group relative h-full flex flex-col justify-between
          bg-card/40 backdrop-blur-sm border border-accent/15 
          hover:border-accent/50 rounded-2xl p-6 md:p-8 
          transition-all duration-500 cursor-pointer overflow-hidden
          ${featured ? 'shadow-[0_0_30px_rgba(201,168,76,0.05)] hover:shadow-[0_0_40px_rgba(201,168,76,0.15)]' : 'hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]'}
          hover:-translate-y-1
        `}>
          {/* Card Hover Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          
          {/* Decorative Corners */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-accent/30 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-accent/30 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-accent/30 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-accent/30 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Content */}
          <div className="relative z-10 flex-grow">
            <h3 className="urdu-text text-2xl md:text-3xl font-bold text-foreground mb-6 group-hover:text-accent transition-colors duration-300">
              {poem.titleUrdu}
            </h3>
            
            <p className="urdu-text text-xl md:text-2xl text-muted-foreground group-hover:text-foreground/90 transition-colors duration-300 line-clamp-4 leading-[2.8]">
              {poem.content}
            </p>
          </div>

          {/* Footer Metadata */}
          <div className="relative z-10 mt-8 pt-6 border-t border-accent/10 flex justify-between items-center flex-row-reverse">
            <div className="flex items-center gap-3 flex-row-reverse">
              <span className="urdu-text text-xl text-accent/90">{poem.poetNameUrdu}</span>
            </div>
            
            <span className="px-3 py-1 rounded-full bg-secondary text-accent/70 text-xs tracking-widest uppercase border border-accent/10">
              {poem.category}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function PoemCardSkeleton() {
  return (
    <div className="h-full bg-card/40 border border-accent/5 rounded-2xl p-6 md:p-8 animate-pulse">
      <div className="flex justify-end mb-6">
        <div className="h-8 w-1/2 bg-accent/10 rounded-md" />
      </div>
      <div className="space-y-4 flex flex-col items-end">
        <div className="h-4 w-full bg-muted/50 rounded-md" />
        <div className="h-4 w-5/6 bg-muted/50 rounded-md" />
        <div className="h-4 w-4/6 bg-muted/50 rounded-md" />
      </div>
      <div className="mt-8 pt-6 border-t border-accent/5 flex justify-between">
        <div className="h-6 w-20 bg-muted/50 rounded-full" />
        <div className="h-6 w-24 bg-accent/10 rounded-md" />
      </div>
    </div>
  );
}
