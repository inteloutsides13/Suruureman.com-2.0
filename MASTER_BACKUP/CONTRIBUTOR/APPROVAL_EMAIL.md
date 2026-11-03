# Approval Email

The implementation is in
`artifacts/api-server/src/lib/contributorApprovalEmail.ts` and the approval
routes. It uses Nodemailer with Hostinger SMTP:

- Host: `smtp.hostinger.com`
- Port: `465`
- Secure TLS mode: `true`
- Sender: `info@suruureman.com`
- Sender name: `Suruur E Man`

The message has HTML and plain-text representations, contains the activation
link, and is sent only after approval/reissue flow. Missing or invalid SMTP
configuration fails safely; the API records sent/failed outcome for the
administrator. The mailbox password is never documented or committed.