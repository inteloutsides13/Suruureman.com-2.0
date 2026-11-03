import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Irab from "./irab";

const fixtures = vi.hoisted(() => ({ mutate: vi.fn(), toast: vi.fn() }));
vi.mock("@workspace/api-client-react", () => ({
  useCreateIrabText: () => ({ isPending: false, mutate: fixtures.mutate }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: fixtures.toast }) }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("existing اِعْراب — e'raab workspace", () => {
  it("preserves RTL input, the counter and canonical metadata", () => {
    render(<Irab />);
    const input = screen.getByTestId("textarea-irab-input");
    expect(input).toHaveAttribute("dir", "rtl");
    fireEvent.change(input, { target: { value: "یہ کتاب ہے" } });
    expect(document.title).toContain("اِعْراب — e'raab");
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toContain("اِعْراب — e'raab");
    expect(screen.getByTestId("button-submit-irab")).not.toBeDisabled();
  });

  it("submits the original text contract, displays/copies a result and clears the workspace", async () => {
    const input = "یہ کتاب ہے\nیہ قلم ہے";
    const output = "یَہ کِتاب ہے\nیَہ قَلَم ہے";
    fixtures.mutate.mockImplementation((_request, callbacks) => callbacks.onSuccess({ success: true, text: output }));
    render(<Irab />);
    fireEvent.change(screen.getByTestId("textarea-irab-input"), { target: { value: input } });
    fireEvent.submit(screen.getByTestId("form-irab"));
    expect(fixtures.mutate).toHaveBeenCalledWith({ data: { text: input } }, expect.any(Object));
    expect(screen.getByTestId("text-irab-result").textContent).toBe(output);
    fireEvent.click(screen.getByTestId("button-copy-result"));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(output));
    fireEvent.click(screen.getByTestId("button-clear-irab"));
    expect(screen.getByTestId("textarea-irab-input")).toHaveValue("");
    expect(screen.queryByTestId("text-irab-result")).not.toBeInTheDocument();
  });

  it("keeps provider failure messages safe and does not fabricate a result", () => {
    fixtures.mutate.mockImplementation((_request, callbacks) => callbacks.onError({ status: 503 }));
    render(<Irab />);
    fireEvent.change(screen.getByTestId("textarea-irab-input"), { target: { value: "یہ کتاب ہے" } });
    fireEvent.submit(screen.getByTestId("form-irab"));
    expect(screen.getByTestId("status-irab-error")).toHaveTextContent("اِعْراب");
    expect(screen.queryByTestId("text-irab-result")).not.toBeInTheDocument();
  });
});
