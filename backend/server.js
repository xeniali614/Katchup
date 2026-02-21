import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
  console.warn('Missing Google OAuth environment variables. Check your .env file.');
}

app.use(cors({
  origin: [
    'http://localhost:8000',
    'http://localhost:3000', 
    'https://xeniali614.github.io', // GitHub Pages domain
    process.env.FRONTEND_ORIGIN 
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false, 
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(frontendRoot));
}

function getFrontendRedirectUrl(req) {
  const configuredRedirect = process.env.FRONTEND_REDIRECT;

  if (!configuredRedirect) {
    return `${req.protocol}://${req.get('host')}/schedule.html`;
  }

  try {
    const configuredUrl = new URL(configuredRedirect);
    if (configuredUrl.hostname === 'localhost' && configuredUrl.port === '8000') {
      return `${req.protocol}://${req.get('host')}${configuredUrl.pathname}${configuredUrl.search}${configuredUrl.hash}`;
    }
    return configuredUrl.toString();
  } catch {
    if (configuredRedirect.startsWith('/')) {
      return `${req.protocol}://${req.get('host')}${configuredRedirect}`;
    }
    return `${req.protocol}://${req.get('host')}/schedule.html`;
  }
}

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

async function getUserTokens(userId) {
  const { data, error } = await supabase
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, expires_in')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expires_in
  };
}

async function refreshTokenIfNeeded(userId, tokens) {
  // Check if token is expired
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);
    
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update tokens in Supabase
      await supabase
        .from('google_calendar_tokens')
        .update({
          access_token: credentials.access_token,
          expires_in: credentials.expiry_date,
          updated_at: new Date()
        })
        .eq('user_id', userId);

      return credentials;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  return tokens;
}

app.get('/auth/google', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).send('Missing userId parameter.');
  }

  const oauth2Client = getOAuthClient();
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: userId // Pass user ID as state for verification on callback
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  const oauth2Client = getOAuthClient();
  const code = req.query.code;
  const userId = req.query.state;

  if (!code) {
    return res.status(400).send('Missing code parameter.');
  }

  if (!userId) {
    return res.status(400).send('Missing user ID in state.');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in Supabase for this user
    const { error: upsertError } = await supabase
      .from('google_calendar_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expiry_date,
        updated_at: new Date()
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error storing tokens:', upsertError);
      return res.status(500).send('Failed to store authentication tokens.');
    }

    // Store user ID in session for status check
    req.session.userId = userId;
    res.redirect(getFrontendRedirectUrl(req));
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Failed to authenticate with Google.');
  }
});

app.get('/calendar/events', async (req, res) => {
  const userId = req.query.userId || req.session.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'User ID required.' });
  }

  try {
    let tokens = await getUserTokens(userId);
    if (!tokens) {
      return res.status(401).json({ error: 'Not connected to Google Calendar.' });
    }

    tokens = await refreshTokenIfNeeded(userId, tokens);
    if (!tokens) {
      return res.status(401).json({ error: 'Failed to refresh authorization.' });
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);

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

app.post('/calendar/events', async (req, res) => {
  const userId = req.body.userId || req.query.userId || req.session.userId;
  const { summary, description, start, end } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'User ID required.' });
  }

  if (!summary || !start || !end) {
    return res.status(400).json({ error: 'Missing summary, start, or end.' });
  }

  try {
    let tokens = await getUserTokens(userId);
    if (!tokens) {
      return res.status(401).json({ error: 'Not connected to Google Calendar.' });
    }

    tokens = await refreshTokenIfNeeded(userId, tokens);
    if (!tokens) {
      return res.status(401).json({ error: 'Failed to refresh authorization.' });
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);

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

app.patch('/calendar/events/:id', async (req, res) => {
  const userId = req.body.userId || req.query.userId || req.session.userId;
  const { id } = req.params;
  const updates = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'User ID required.' });
  }

  try {
    let tokens = await getUserTokens(userId);
    if (!tokens) {
      return res.status(401).json({ error: 'Not connected to Google Calendar.' });
    }

    tokens = await refreshTokenIfNeeded(userId, tokens);
    if (!tokens) {
      return res.status(401).json({ error: 'Failed to refresh authorization.' });
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);

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

app.delete('/calendar/events/:id', async (req, res) => {
  const userId = req.query.userId || req.session.userId;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'User ID required.' });
  }

  try {
    let tokens = await getUserTokens(userId);
    if (!tokens) {
      return res.status(401).json({ error: 'Not connected to Google Calendar.' });
    }

    tokens = await refreshTokenIfNeeded(userId, tokens);
    if (!tokens) {
      return res.status(401).json({ error: 'Failed to refresh authorization.' });
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);

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
  req.session.userId = null;
  res.json({ success: true });
});

app.get('/auth/status', async (req, res) => {
  const userId = req.query.userId || req.session.userId;
  
  if (!userId) {
    return res.json({ authenticated: false });
  }

  try {
    const tokens = await getUserTokens(userId);
    res.json({ authenticated: !!tokens });
  } catch (error) {
    res.json({ authenticated: false });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'index.html'));
});

app.listen(port, () => {
  console.log(`Calendar backend running on http://localhost:${port}`);
});
