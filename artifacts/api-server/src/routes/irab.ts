import { Router, type IRouter } from "express";
import { CreateIrabTextBody, CreateIrabTextResponse } from "@workspace/api-zod";
import { requireIrabAccess } from "../middlewares/adminAuth.js";
import { irabRateLimit } from "../lib/rateLimit.js";
import { generateIrab, IrabServiceError } from "../lib/irabService.js";

const router: IRouter = Router();

router.post("/irab/text", requireIrabAccess, irabRateLimit, async (req, res): Promise<void> => {
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    Object.keys(req.body).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(req.body, "text")
  ) {
    res.status(400).json({ success: false, error: "براہِ کرم درست متن درج کریں۔" });
    return;
  }

  const requestText = req.body && typeof req.body === "object" ? req.body.text : undefined;
  if (typeof requestText === "string" && Array.from(requestText).length > 20_000) {
    res.status(413).json({ success: false, error: "متن ۲۰،۰۰۰ حروف سے زیادہ نہیں ہو سکتا۔" });
    return;
  }

  const parsed = CreateIrabTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "براہِ کرم درست متن درج کریں۔" });
    return;
  }

  if (parsed.data.text.trim().length === 0) {
    res.status(400).json({ success: false, error: "براہِ کرم خالی متن کے بجائے کلام درج کریں۔" });
    return;
  }

  try {
    const text = await generateIrab(parsed.data.text);
    res.json(CreateIrabTextResponse.parse({ success: true, text }));
  } catch (error) {
    if (error instanceof IrabServiceError) {
      const status =
        error.kind === "configuration" ||
        error.kind === "provider-auth" ||
        error.kind === "provider-unavailable" ||
        error.kind === "provider" ||
        error.kind === "invalid-output"
          ? error.kind === "configuration" ||
            error.kind === "provider-auth" ||
            error.kind === "provider-unavailable"
            ? 503
            : 502
          : error.kind === "timeout"
            ? 504
            : 500;
      const message =
        error.kind === "timeout"
          ? "اِعْراب لگانے میں وقت زیادہ لگ گیا، براہِ کرم دوبارہ کوشش کریں۔"
          : error.kind === "configuration" ||
              error.kind === "provider-auth" ||
              error.kind === "provider-unavailable" ||
              error.kind === "provider" ||
              error.kind === "invalid-output"
            ? "اِعْراب سروس عارضی طور پر دستیاب نہیں۔ براہِ کرم کچھ دیر بعد دوبارہ کوشش کریں۔"
            : "درخواست مکمل نہیں ہو سکی۔";

      res.status(status).json({ success: false, error: message });
      return;
    }

    req.log.error({ outcome: "unexpected", errorCategory: "internal" }, "Unexpected I‘rab error");
    res.status(500).json({ success: false, error: "درخواست مکمل نہیں ہو سکی۔" });
  }
});

export default router;