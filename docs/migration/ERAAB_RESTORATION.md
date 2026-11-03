# اِعْراب — e'raab restoration verification

Date: 2026-10-06.

## Source integrity and scope

Existing implementation found: **YES**. The verified source backup contains the complete text page, access guard, API handler, Gemini service, retry helper, output guard and strict linguistic instructions. No replacement implementation or design was created.

The following remain byte-for-byte identical to the verified archived source:

- Linguistic instructions
- Gemini service, including `gemini-3.8-flash`, original request/configuration and 30-second overall deadline
- Retry implementation
- Output guard
- Rate limiter (5 requests per 15 minutes)
- Text API handler

Current GitHub main could not be independently verified: unauthenticated GitHub API returned HTTP 404. This is not proof that the repository does not exist. Source fidelity is established against the verified backup, not an unverified claim about today's production commit.

## Narrow compatibility corrections

- Preserved `/irab` and `POST /api/irab/text`.
- Allowed only the exact stateless text POST through the migration gate. Original JWT, allowed-role, active-account/revocation, validation and rate-limit middleware still apply.
- PostgreSQL continues enforcing read-only mode. Login, contact, likes and other mutations stay blocked with HTTP 423.
- Canonical metadata now applies to the login-required route as well as the protected page.
- Tool cards recognize legacy names and the technical `/irab` URL, require both a session and an allowed role, and render canonical terminology without updating stored records.
- No page styling, layout, linguistic behavior, provider model or OCR changes.

## Actual checks

- Anonymous text POST: HTTP 401.
- Developer, admin, contributor: original live JWT/account validation passed; empty text reached normal HTTP 400 input validation.
- Short-lived verification sessions were used, not password sign-in; no accounts were created or modified. Session tokens were private and not logged.
- Initial real synthetic text through the protected API reached the preserved 30-second deadline and returned HTTP 504. In the focused browser pass, one additional real two-line synthetic request succeeded with **HTTP 200**. Backend logs confirmed a transient HTTP 503 on attempt 1, the existing 1-second delay, and success on attempt 2 after 29,389 ms total. The original output guard passed before returning the displayed result. Earlier verification also exercised all four attempts. Provider availability has been intermittent; no timing/model behavior was changed.
- Database session policy: read-only. Published-poem count stayed 790 before/after verification; no writes were performed.
- Backend tests: 28 passed, including roles, disabled/revoked accounts, invalid tokens, retry caps/permanent errors, output guard and migration gate.
- Frontend tests: 76 passed, including original input contract, result rendering, Copy Result, Clear, canonical metadata and visitor card hiding.
- Root typecheck passed; subsequent backend typecheck with added regression tests passed.
- Backend build passed during migration-safe workflow restart. Frontend production build passed.
- Existing dependency/TLS interpretation and bundle-size warnings remain visible; TLS was not weakened.

## Focused browser verification

- Anonymous desktop/mobile route: original login-required state, canonical heading/title/metadata; protected navigation entry hidden, including expanded mobile menu.
- Developer/admin/contributor: protected form and authenticated navigation accessible using original valid short-lived sessions.
- One real admin browser request: authorization header and original text JSON contract confirmed; Gemini HTTP 200 displayed a two-line result. No further real submissions were made.
- Separate, clearly identified intercepted UI fixture: diacritics-only synthetic result retained line breaks, Copy wrote the exact result to the clipboard, Clear reset input/result/counter to `0 / 20,000`. These fixture checks are not claimed as provider evidence.
- Desktop 1280×800 and mobile 390×844: no horizontal overflow; dark background, gold/crimson colors, Urdu typography, RTL, original cards/buttons/header/footer preserved. Only the protected English navigation label is exempted from CSS uppercasing so it displays canonical lowercase `e'raab`.
- No application console/runtime errors observed.
- Public production `/irab` screenshot confirms the same sign-in card, dark/gold/crimson presentation, Urdu typography and public navigation. No authenticated requests were made to the old production site. Protected workspace layout was preserved from the verified source; an authenticated pixel-by-pixel production comparison was not performed.
- Authenticated browser contexts were closed and localStorage sessions cleared. Private temporary session file was removed after verification.

## Safety and remaining limits

No database schema/data modifications, text persistence, OCR, publishing, DNS changes or old-production modifications. Production command remains gated.

Successful real annotation is now verified, including recovery through the unchanged retry mechanism. Intermittent provider HTTP 503/timeouts remain an external availability concern. Do not change the model, timeout, instructions, guard or retry settings to conceal those failures.

Password sign-in remains intentionally blocked in this read-only migration preview. Role/session access was verified without changing database write policy. Current GitHub main remains inaccessible to this verification.
