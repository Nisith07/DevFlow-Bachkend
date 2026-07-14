# DevFlow Backend

Authentication API for DevFlow. It supports email/password accounts and Google sign-in, storing user profiles in MongoDB.

## Setup

1. Copy `.env.example` to `.env` and set its values.
2. In Google Cloud Console, create an OAuth 2.0 Web Client and add the exact `GOOGLE_CALLBACK_URL` as an authorised redirect URI.
3. Install and run:

```bash
npm install
npm run dev
```

The API runs at `http://localhost:5000` by default.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create an account with `name`, `email`, and `password` |
| POST | `/api/auth/login` | Sign in with `email` and `password` |
| GET | `/api/auth/google` | Start Google sign-in |
| GET | `/api/auth/me` | Get the signed-in user |
| POST | `/api/auth/logout` | Clear the session |

Authentication is held in an HTTP-only `devflow_token` cookie. Browser requests from the frontend must include credentials, for example `fetch(url, { credentials: 'include' })`.
