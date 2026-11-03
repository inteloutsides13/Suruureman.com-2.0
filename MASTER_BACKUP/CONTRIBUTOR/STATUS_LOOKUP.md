# Status Lookup

The public status endpoint is `POST /api/contributor-application-status`.
The lookup uses first name, date of birth, and email, is rate limited, and
selects the newest matching application. It reports the application state and
next steps without exposing unrelated applications.

The frontend page is `/contributor-status`. Status lookup is not a substitute
for activation; an approved applicant still needs a valid activation flow.