import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
  console.warn('Missing Google OAuth environment variables. Check your .env file.');
}

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function requireTokens(req, res, next) {
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not connected to Google Calendar.' });
  }
  next();
}

app.get('/auth/google', (req, res) => {
  const oauth2Client = getOAuthClient();
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  const oauth2Client = getOAuthClient();
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('Missing code parameter.');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    res.redirect(process.env.FRONTEND_REDIRECT || '/');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Failed to authenticate with Google.');
  }
});

app.get('/calendar/events', requireTokens, async (req, res) => {
  try {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(req.session.tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime'
    });

    res.json({ events: data.items || [] });
  } catch (error) {
    console.error('Fetch events error:', error);
    res.status(500).json({ error: 'Failed to load events.' });
  }
});

app.post('/calendar/events', requireTokens, async (req, res) => {
  const { summary, description, start, end } = req.body || {};

  if (!summary || !start || !end) {
    return res.status(400).json({ error: 'Missing summary, start, or end.' });
  }

  try {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(req.session.tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start,
        end
      }
    });

    res.json({ event: data });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

app.patch('/calendar/events/:id', requireTokens, async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  try {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(req.session.tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { data } = await calendar.events.patch({
      calendarId: 'primary',
      eventId: id,
      requestBody: updates
    });

    res.json({ event: data });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event.' });
  }
});

app.delete('/calendar/events/:id', requireTokens, async (req, res) => {
  const { id } = req.params;

  try {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(req.session.tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: id
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event.' });
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.tokens = null;
  res.json({ success: true });
});

app.get('/auth/status', (req, res) => {
  res.json({ authenticated: Boolean(req.session.tokens) });
});

app.listen(port, () => {
  console.log(`Calendar backend running on http://localhost:${port}`);
});
