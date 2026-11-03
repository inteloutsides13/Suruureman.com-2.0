declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export type AnalyticsEvent =
  | "poem_view"
  | "like_click"
  | "unlike_click"
  | "share_click"
  | "search_query"
  | "page_view";

export interface EventData {
  poem_id?: number;
  poem_title?: string;
  poet_name?: string;
  share_method?: string;
  query?: string;
  page?: string;
  [key: string]: unknown;
}

export function trackEvent(event: AnalyticsEvent, data: EventData = {}) {
  if (import.meta.env.DEV) {
    console.debug(`[Analytics] ${event}`, data);
  }
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", event, data);
  }
}

export function trackPageView(path: string, title: string) {
  trackEvent("page_view", { page: path, poem_title: title });
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("config", "GA_MEASUREMENT_ID", {
      page_path: path,
      page_title: title,
    });
  }
}
