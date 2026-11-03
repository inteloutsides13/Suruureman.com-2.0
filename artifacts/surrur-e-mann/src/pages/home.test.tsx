import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./home";

const mocks = vi.hoisted(() => ({
  useGetDailyPoem: vi.fn(),
  useListPoems: vi.fn(),
  useListCategories: vi.fn(),
  useListVideos: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetDailyPoem: mocks.useGetDailyPoem,
  useListPoems: mocks.useListPoems,
  useListCategories: mocks.useListCategories,
  useListVideos: mocks.useListVideos,
}));
vi.mock("@/hooks/use-seo", () => ({ useSeo: vi.fn() }));
vi.mock("@/components/social-links", () => ({
  SocialLinks: () => <div data-testid="social-links" />,
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  });
  mocks.useGetDailyPoem.mockReturnValue({
    data: {
      day: "2026-10-16",
      poem: {
        id: 42,
        titleUrdu: "نمونہ",
        poetNameUrdu: "شاعر",
        lines: ["پہلا مصرع", "دوسرا مصرع", "تیسرا مصرع", "چوتھا مصرع"],
      },
    },
    isLoading: false,
    isError: false,
  });
  mocks.useListPoems.mockReturnValue({ data: { poems: [], total: 0 }, isLoading: false });
  mocks.useListCategories.mockReturnValue({ data: { categories: [] }, isLoading: false });
  mocks.useListVideos.mockReturnValue({ data: { videos: [] }, isLoading: false });
});

describe("homepage poetry sections", () => {
  it("keeps the hero branding without rendering the featured poem in the hero", () => {
    const featuredPoem = {
      id: 7,
      titleUrdu: "نمونہ عنوان",
      poetNameUrdu: "نمونہ شاعر",
      content: "ہیرو کا شعر\nدوسرا مصرع",
    };
    mocks.useListPoems.mockImplementation((params: { featured?: boolean }) => ({
      data: params?.featured ? { poems: [featuredPoem], total: 1 } : { poems: [], total: 0 },
      isLoading: false,
    }));

    render(<Home />);

    const hero = screen.getByRole("heading", { name: "ہر لفظ میں ایک کیفیت" }).closest("section")!;
    expect(within(hero).getByText("The State Within Every Word")).toBeInTheDocument();
    expect(within(hero).queryByText(/ہیرو کا شعر|نمونہ شاعر/)).not.toBeInTheDocument();

    const visualSection = screen.getByRole("heading", { name: "تصویری شاعری" }).closest("section")!;
    expect(within(visualSection).getByText("نمونہ عنوان")).toBeInTheDocument();
    expect(within(visualSection).getByText("ہیرو کا شعر")).toBeInTheDocument();
  });

  it("orders the hero, daily poem, Latest Works, and remaining sections without duplicating sections", () => {
    render(<Home />);

    expect(screen.getAllByRole("heading", { name: "تازہ کلام" })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "آج کا شعر" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "نمایاں اشعار" })).not.toBeInTheDocument();

    const hero = screen.getByRole("heading", { name: "ہر لفظ میں ایک کیفیت" }).closest("section")!;
    const dailyHeading = screen.getByRole("heading", { name: "آج کا شعر" });
    const dailySection = dailyHeading.closest("section")!;
    const latestSection = screen.getByRole("heading", { name: "تازہ کلام" }).closest("section")!;
    const popularSection = screen.getByRole("heading", { name: "مقبول کلام" }).closest("section")!;
    expect(hero.compareDocumentPosition(dailySection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(dailySection.compareDocumentPosition(latestSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(latestSection.compareDocumentPosition(popularSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    for (const line of ["پہلا مصرع", "دوسرا مصرع", "تیسرا مصرع", "چوتھا مصرع"]) {
      expect(within(dailySection).getByText(line)).toBeInTheDocument();
    }
    expect(within(dailySection).getAllByText(/مصرع/)).toHaveLength(4);
    expect(within(dailySection).getByRole("link", { name: "مکمل کلام پڑھیے" })).toHaveAttribute("href", "/poems/42");
  });
});
