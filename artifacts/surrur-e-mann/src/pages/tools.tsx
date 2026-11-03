import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink, Wrench } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { hasIrabAccessRole, useAdminAuth } from "@/hooks/use-admin-auth";
import { useSeo } from "@/hooks/use-seo";

interface Tool {
  id: number;
  title: string;
  titleUrdu: string;
  description: string;
  descriptionUrdu: string;
  url: string;
  active: boolean;
  displayOrder: number;
}

const localIrabTool: Tool = {
  id: -1,
  title: "e'raab",
  titleUrdu: "اِعْراب",
  description: "",
  descriptionUrdu: "",
  url: "/irab",
  active: true,
  displayOrder: -1,
};

function isIrabTool(tool: Tool): boolean {
  const title = `${tool.title} ${tool.titleUrdu}`.toLowerCase();
  const route = (() => {
    try { return new URL(tool.url, window.location.origin).pathname.replace(/\/+$/, ""); }
    catch { return ""; }
  })();
  return (
    route === "/irab" ||
    /\birab\b/.test(title) ||
    title.includes("e'raab") ||
    title.includes("aeraab") ||
    title.includes("i‘rab") ||
    title.includes("i'rab") ||
    title.includes("iraab") ||
    title.includes("عراب")
  );
}

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const irab = isIrabTool(tool);
  const canonicalDescription = (text: string) => irab
    ? text.replace(/\b(?:irab|i['‘’]rab|iraab|aeraab|e['‘’]raab)\b/gi, "e'raab")
    : text;
  return (
    <motion.a
      href={irab ? "/irab" : tool.url}
      target={irab ? undefined : "_blank"}
      rel={irab ? undefined : "noopener noreferrer"}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      className="group block bg-card/40 border border-accent/15 hover:border-accent hover:bg-accent/5 rounded-2xl p-8 transition-all duration-300 shadow-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.1)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <Wrench size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold text-foreground tracking-wider group-hover:text-accent transition-colors">
                {irab ? "e'raab" : tool.title}
              </h3>
              <p className="font-urdu text-sm text-accent/70 leading-relaxed mt-0.5">
                {irab ? "اِعْراب" : tool.titleUrdu}
              </p>
            </div>
          </div>

          {tool.descriptionUrdu && (
            <p className="font-urdu text-base text-muted-foreground leading-relaxed text-right mt-4 border-t border-accent/10 pt-4">
              {canonicalDescription(tool.descriptionUrdu)}
            </p>
          )}
          {tool.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {canonicalDescription(tool.description)}
            </p>
          )}
        </div>

        <div className="shrink-0 mt-1">
          <div className="w-8 h-8 rounded-lg border border-accent/20 flex items-center justify-center text-accent/50 group-hover:text-accent group-hover:border-accent group-hover:bg-accent/10 transition-all duration-300">
            {irab ? <ArrowRight size={14} /> : <ExternalLink size={14} />}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-[10px] font-heading tracking-widest uppercase text-accent/50 group-hover:text-accent transition-colors">
        <span>Open Tool</span>
        {irab ? <ArrowRight size={10} /> : <ExternalLink size={10} />}
      </div>
    </motion.a>
  );
}

function ToolCardSkeleton() {
  return (
    <div className="bg-card/40 border border-accent/10 rounded-2xl p-8 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent/10" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-accent/10 rounded w-2/3" />
          <div className="h-3 bg-accent/5 rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-accent/5 rounded w-full mt-4" />
      <div className="h-3 bg-accent/5 rounded w-4/5 mt-2" />
    </div>
  );
}

export default function ToolsPage() {
  useSeo({
    title: "Urdu Poetry Tools",
    description: "Explore useful tools for reading and understanding Urdu poetry, including pronunciation and e'raab resources.",
  });
  const { role, isAuthenticated } = useAdminAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const canAccessIrab = isAuthenticated && hasIrabAccessRole(role);
  // e'raab is an in-app protected route; do not depend on its shared tools row being active.
  const toolsForDisplay = canAccessIrab && !tools.some(isIrabTool)
    ? [...tools, localIrabTool]
    : tools;
  const visibleTools = toolsForDisplay.filter((tool) => canAccessIrab || !isIrabTool(tool));

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.ok ? r.json() : { tools: [] })
      .then((d) => setTools(d.tools || []))
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-[70vh]">
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Tools" titleUrdu="اردو ٹولز" semanticLevel="h1" />

          <div className="mt-14">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => <ToolCardSkeleton key={i} />)}
              </div>
            ) : visibleTools.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
                  <Wrench size={28} className="text-accent/50" />
                </div>
                <p className="font-urdu text-2xl text-muted-foreground mb-2">جلد آ رہا ہے</p>
                <p className="font-heading text-xs tracking-widest uppercase text-muted-foreground/40">
                  Tools Coming Soon
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleTools.map((tool, i) => (
                  <ToolCard key={tool.id} tool={tool} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
