import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  getConfiguredSocialLinks,
  PUBLIC_SOCIAL_SETTINGS_QUERY_KEY,
  SocialLinks,
} from "./social-links";

const configuredSettings = {
  social_facebook: "https://www.facebook.com/example",
  social_twitter: "https://x.com/example",
  social_youtube: "https://www.youtube.com/@example",
  social_tiktok: "https://www.tiktok.com/@example",
  social_instagram: "https://www.instagram.com/example",
};

function renderSocialLinks() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SocialLinks />
    </QueryClientProvider>,
  );
  return queryClient;
}

function settingsResponse(settings: Record<string, string | null | undefined>) {
  return {
    ok: true,
    json: async () => ({ settings }),
  };
}

describe("homepage social links", () => {
  it("renders every configured platform with safe external-link attributes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(settingsResponse(configuredSettings)));
    renderSocialLinks();

    for (const [platform, url] of Object.entries(configuredSettings)) {
      const link = await screen.findByTestId(`social-link-${platform.replace("social_", "")}`);
      expect(link).toHaveAttribute("href", url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAccessibleName();
    }
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("renders only valid configured URLs and omits missing, empty, or unsafe values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(settingsResponse({
      social_facebook: null,
      social_twitter: " ",
      social_youtube: "http://youtube.com/@example",
      social_tiktok: "https://tiktok.com.evil.example/@example",
      social_instagram: "https://instagram.com/example",
    })));
    renderSocialLinks();

    expect(await screen.findByTestId("social-link-instagram")).toBeInTheDocument();
    expect(screen.queryByTestId("social-link-facebook")).not.toBeInTheDocument();
    expect(screen.queryByTestId("social-link-twitter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("social-link-youtube")).not.toBeInTheDocument();
    expect(screen.queryByTestId("social-link-tiktok")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders no wrapper or reserved space when no URL is configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(settingsResponse({
      social_facebook: "",
      social_twitter: null,
    })));
    renderSocialLinks();

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.queryByRole("navigation", { name: "Social media" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("updates and removes buttons after public settings are invalidated", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(settingsResponse({ social_facebook: configuredSettings.social_facebook }))
      .mockResolvedValueOnce(settingsResponse({ social_twitter: configuredSettings.social_twitter }));
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = renderSocialLinks();

    expect(await screen.findByTestId("social-link-facebook")).toHaveAttribute("href", configuredSettings.social_facebook);
    await queryClient.invalidateQueries({ queryKey: PUBLIC_SOCIAL_SETTINGS_QUERY_KEY });

    expect(await screen.findByTestId("social-link-twitter")).toHaveAttribute("href", configuredSettings.social_twitter);
    await waitFor(() => expect(screen.queryByTestId("social-link-facebook")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects non-HTTPS URLs, credentials, and domains outside each platform", () => {
    expect(getConfiguredSocialLinks({
      social_facebook: "https://facebook.com.evil.example/account",
      social_twitter: "https://user:pass@x.com/account",
      social_youtube: "https://youtube.com:8443/@account",
      social_instagram: "https://instagram.com/account",
      social_tiktok: "javascript:alert(1)",
    }).map(({ key }) => key)).toEqual(["social_instagram"]);
  });
});
