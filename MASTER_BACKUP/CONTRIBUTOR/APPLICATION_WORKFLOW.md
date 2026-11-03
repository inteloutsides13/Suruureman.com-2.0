# Application Workflow

## Endpoints

- `POST /api/contributor-applications`: validate and create a public application.
- `POST /api/contributor-application-status`: rate-limited status lookup by first
  name, DOB, and email; the newest matching application is used.
- `GET /api/admin/contributor-applications`: review queue.
- `GET /api/admin/contributor-applications/:id`: application detail.
- `POST /api/admin/contributor-applications/:id/approve`: approve and begin
  activation/email flow.
- `POST /api/admin/contributor-applications/:id/reject`: reject with reason.
- `POST /api/admin/contributor-applications/:id/reissue-activation`: issue a
  replacement activation message.

The exact request validation and response envelopes are in
`artifacts/api-server/src/routes/contributor-applications.ts`.