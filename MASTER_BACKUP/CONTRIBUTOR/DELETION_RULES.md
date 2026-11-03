# Deletion Rules

Contributor deletion is an admin operation with a separate impact preview:

- `POST /api/admin/contributors/delete-impact` calculates the affected records.
- `DELETE /api/admin/contributors` performs the chosen deletion behavior.
- The UI distinguishes retaining published content from deleting attributable
  content, and the server applies the final ownership/content policy.
- Account disable/enable and password reset are separate lifecycle actions.
- Deletion must be reviewed and authorized; it is not part of clone/bootstrap.

Never run deletion against production as a backup or test step.