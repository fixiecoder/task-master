# Task Master

Task management tool for the `colinadams.co` suite (`task-master.colinadams.co`).

Authenticates via the shared SSO Hub (`colinadams-auth`) and will use `colinadams-api` for data persistence. See `CLAUDE.md` for architecture notes and the root suite `../CLAUDE.md` for how the SSO flow works across apps.

## Commands

```bash
npm run dev       # Start Vite dev server on port 3005
npm run build     # tsc -b + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

## Local setup

Copy `.env.example` to `.env` and fill in the Firebase project credentials shared across the suite.
