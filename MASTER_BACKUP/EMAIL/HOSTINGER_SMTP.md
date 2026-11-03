# Hostinger SMTP

## Current contract

The approval mailer uses Nodemailer and reads:

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@suruureman.com
SMTP_PASSWORD=<SET_IN_REPLIT_SECRETS>
MAIL_FROM=info@suruureman.com
MAIL_FROM_NAME=Suruur E Man
PUBLIC_APP_URL=<SET_TO_CANONICAL_APP_URL>
```

Only the placeholder form belongs in documentation. The mailbox password is
secret and must be supplied through Replit Secrets or the deployment secret
store.

## Behavior

- Approval and activation messages provide HTML and plain-text alternatives.
- The link is based on `PUBLIC_APP_URL`, expires after 72 hours, and is
  single-use.
- Reissue creates a replacement activation capability.
- Missing/invalid configuration fails safely instead of pretending delivery
  succeeded.
- Admin-visible sent/failed state is recorded by the approval workflow.

Source: `artifacts/api-server/src/lib/contributorApprovalEmail.ts` and
`artifacts/api-server/src/routes/contributor-applications.ts`.