# Notifications System Setup

## Required Database Table

You need to create a `notifications` table in Supabase with the following schema:

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('photos_uploaded', 'letter_written')),
  letter_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_group ON notifications(group_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Enable RLS if needed
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
```

## How It Works

### Photo Upload Notifications

- When a user uploads photos totaling 3+ per week, a notification is sent to all other group members
- Notification type: `photos_uploaded`

### Letter Notifications

- When a user writes a letter, a notification is sent to all other group members in that group
- Notification type: `letter_written`
- Includes the letter title

### Dashboard Display

- Users see notifications from all their groups (excluding their own actions)
- Notifications update automatically every 30 seconds
- Shows most recent notifications first

## notification Table Columns

- `id` - Unique notification ID
- `user_id` - User who triggered the notification
- `recipient_id` - User who receives the notification
- `group_id` - Group the notification is related to
- `type` - Type of notification (`photos_uploaded` or `letter_written`)
- `letter_title` - Title of the letter (only for letter notifications)
- `created_at` - When the notification was created
- `is_read` - Whether the recipient has seen it (optional, for future implementation)
