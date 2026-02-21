# Katchup

## Local run (Google Calendar)

1. In `backend/.env`, set Google + Supabase keys and keep these local URLs:
   - `GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback`
   - `FRONTEND_ORIGIN=http://localhost:3000`
   - `FRONTEND_REDIRECT=http://localhost:3000/schedule.html`
2. Start backend:
   - `cd backend`
   - `npm install`
   - `npm run dev`
3. Open `http://localhost:3000/schedule.html`.

The backend now serves the HTML files directly, so a separate frontend server is not required for the OAuth return page.
