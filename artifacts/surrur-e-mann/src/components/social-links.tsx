import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

export const PUBLIC_SOCIAL_SETTINGS_QUERY_KEY = ["public-social-settings"] as const;

const SOCIAL_PLATFORMS = [
  { key: "social_facebook", label: "Facebook", hosts: ["facebook.com", "fb.com"], Icon: Facebook },
  { key: "social_twitter", label: "Twitter / X", hosts: ["x.com", "twitter.com"], Icon: Twitter },
  { key: "social_youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"], Icon: Youtube },
  { key: "social_instagram", label: "Instagram", hosts: ["instagram.com"], Icon: Instagram },
  { key: "social_tiktok", label: "TikTok", hosts: ["tiktok.com"], Icon: null },
] as const;

type SocialSettings = Record<string, string | null | undefined>;

function validSocialUrl(value: string | null | undefined, allowedHosts: readonly string[]): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    const isAllowedHost = allowedHosts.some((host) =>
      url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
    if (url.protocol !== "https:" || !isAllowedHost || url.username || url.password || url.port) return null;
    return url.href;
  } catch {
    return null;
  }
}

async function fetchPublicSocialSettings(): Promise<SocialSettings> {
  const response = await fetch("/api/admin/settings/public");
  if (!response.ok) throw new Error("Public social links could not be loaded");
  const data = await response.json() as { settings?: SocialSettings };
  return data.settings ?? {};
}

export function getConfiguredSocialLinks(settings: SocialSettings) {
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    const href = validSocialUrl(settings[platform.key], platform.hosts);
    return href ? [{ ...platform, href }] : [];
  });
}

function TikTokIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.79a4.85 4.85 0 0 1-1.01-.1z" />
    </svg>
  );
}

export function SocialLinks({ className = "" }: { className?: string }) {
  const { data: settings = {} } = useQuery({
    queryKey: PUBLIC_SOCIAL_SETTINGS_QUERY_KEY,
    queryFn: fetchPublicSocialSettings,
  });
  const links = getConfiguredSocialLinks(settings);

  if (links.length === 0) return null;

  return (
    <nav aria-label="Social media" className={`flex items-center justify-center gap-3 ${className}`}>
      {links.map(({ key, label, href, Icon }) => (
        <a
          key={key}
          data-testid={`social-link-${key.replace("social_", "")}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/25 bg-background/35 text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {Icon ? <Icon aria-hidden="true" size={18} /> : <TikTokIcon />}
        </a>
      ))}
    </nav>
  );
}
