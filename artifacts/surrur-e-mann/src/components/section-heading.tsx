import { motion } from "framer-motion";

interface SectionHeadingProps {
  title: string;
  titleUrdu: string;
  align?: "left" | "center" | "right";
  semanticLevel?: "h1" | "h2";
}

export function SectionHeading({
  title,
  titleUrdu,
  align = "center",
  semanticLevel = "h2",
}: SectionHeadingProps) {
  const alignmentClass = 
    align === "center" ? "items-center text-center" : 
    align === "left" ? "items-start text-left" : 
    "items-end text-right";

  return (
    <motion.div 
      className={`flex flex-col ${alignmentClass} mb-12 md:mb-16`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex flex-col items-center gap-2">
        {semanticLevel === "h1" ? (
          <>
            <h1 className="font-urdu text-4xl md:text-5xl text-accent text-glow-gold">
              {titleUrdu}
            </h1>
            <h2 className="font-heading text-sm md:text-base tracking-[0.3em] uppercase text-muted-foreground mt-4">
              {title}
            </h2>
          </>
        ) : (
          <>
            <h2 className="font-urdu text-4xl md:text-5xl text-accent text-glow-gold">
              {titleUrdu}
            </h2>
            <h3 className="font-heading text-sm md:text-base tracking-[0.3em] uppercase text-muted-foreground mt-4">
              {title}
            </h3>
          </>
        )}
      </div>
      
      {align === "center" && (
        <div className="mt-6 flex items-center justify-center gap-4 opacity-70">
          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent to-accent/50" />
          <div className="w-2 h-2 rotate-45 border border-accent" />
          <div className="w-12 h-[1px] bg-gradient-to-l from-transparent to-accent/50" />
        </div>
      )}
    </motion.div>
  );
}
