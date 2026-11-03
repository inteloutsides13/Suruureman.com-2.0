# Frontend Routes

Routes are registered in `artifacts/surrur-e-mann/src/App.tsx`.

## Public

| Path | Purpose | Access |
|---|---|---|
| `/` | Home/featured content | Public |
| `/poetry/:language` | Language-filtered poetry | Public |
| `/poems` | Collection browser and filters | Public |
| `/poems/:id` | Poem detail, likes, sharing | Public |
| `/videos` | Video collection | Public |
| `/poets` | Poet collection | Public |
| `/poets/:id` | Poet detail | Public |
| `/search` | Search results | Public |
| `/contact` | Contact form | Public |
| `/tools` | Active tools/resources | Public |
| `/radio` | Radio status/player/editorial surface | Public |
| `/become-a-contributor` | Contributor application | Public |
| `/contributor-status` | Application status lookup | Public |
| `/contributor/activate/:token` | Activation form | Public with token |

## Admin

`/admin/login` is public. Other admin pages are guarded by the role-aware
frontend guards and corresponding API middleware.

`/admin`, `/admin/dashboard`, `/admin/poems`, `/admin/poems/new`,
`/admin/poems/:id/edit`, `/admin/poets`, `/admin/poets/new`,
`/admin/poets/:id/edit`, `/admin/videos`, `/admin/videos/new`,
`/admin/videos/:id/edit`, `/admin/visual-poetry`, `/admin/messages`,
`/admin/settings`, `/admin/categories`, `/admin/tools`, `/admin/contributors`,
`/admin/pending`, `/admin/radio`, and `/admin/contributor-applications` are
admin/developer surfaces. `/admin/backups` and `/admin/users` are developer-only.

## Contributor portal

`/contributor`, `/contributor/dashboard`, `/contributor/submissions`,
`/contributor/poems/new`, `/contributor/poems/:id/edit`,
`/contributor/poets/new`, and `/contributor/radio` require an active contributor
JWT. Admin/developer users are redirected to the admin dashboard.