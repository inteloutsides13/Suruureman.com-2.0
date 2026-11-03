# Environment Setup

Use `DEPLOYMENT/ENVIRONMENT_VARIABLES.md` and `.env.example`. Set secrets
through the environment manager, not a tracked file. Required production values
include `DATABASE_URL`, `JWT_SECRET`, and valid bootstrap/admin credentials only
when an empty database needs initialization. Email and radio values are optional
until those subsystems are enabled.