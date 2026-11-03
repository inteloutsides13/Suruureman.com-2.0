# Installation

1. Install Node.js 24 and pnpm.
2. Clone the `Suruureman.com` repository.
3. Run `pnpm install --frozen-lockfile`.
4. Confirm workspace packages resolve with `pnpm -r list --depth 0`.
5. Keep generated API packages aligned with `lib/api-spec`.

The lockfile is part of the source backup and should be used for reproducible
installation.