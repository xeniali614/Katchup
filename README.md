# Katchup

## Local run (Google Calendar)

1. In `backend/.env`, set Google + Supabase keys and keep these local URLs:
   - `GOOGLE_CLIENT_ID=446059595611-a1hli66d4i5kcdkugecohetktm1k5maf.apps.googleusercontent.com`
   - (Google client secret)
   - `GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback`
   - (Session secret)
   - `FRONTEND_ORIGIN=http://localhost:8000`
   - `FRONTEND_REDIRECT=http://localhost:8000/schedule.html`
   - `PORT=3001`
   - `SUPABASE_URL=https://nmqlzczhnnznknccctpv.supabase.co`
   - `SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcWx6Y3pobm56bmtuY2NjdHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjY3OTUsImV4cCI6MjA4NzIwMjc5NX0.372zQMRRDDRqaNAojOyomkHhQpi1Co-y8Qkba93hyRw`
2. Start backend:
   - `cd backend`
   - `npm install`
   - `npm run backend`
3. Open a new terminal
   - `npm run start`
   - Paste the copied local host URL into your browser

The backend now serves the HTML files directly, so a separate frontend server is not required for the OAuth return page.
