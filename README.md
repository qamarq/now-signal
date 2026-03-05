# Now Signal MVP

Real-time global event detection and notification system built with Next.js, Postgres, Better Auth, shadcn/ui, Inngest, and Firebase Cloud Messaging.

## Features

- **Event Detection**: Monitors RSS feeds and clusters related signals into events
- **Smart Scoring**: Calculates early and confirmation scores based on source diversity, velocity, and coherence
- **Push Notifications**: Web push via Firebase Cloud Messaging with deduplication and limits
- **User Preferences**: Categories, regions, sensitivity levels, quiet hours, and daily limits
- **Two Notification Modes**:
  - **CONFIRMED** (default ON): Only verified events from multiple trusted sources
  - **EARLY** (default OFF): Early signals/rumors based on momentum analysis

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth (email + password)
- **Background Jobs**: Inngest (cron every 10 min)
- **Push Notifications**: Firebase Cloud Messaging

## Quick Start

### 1. Prerequisites

- Node.js 18+
- pnpm
- Docker & Docker Compose
- Firebase project (for push notifications)

### 2. Clone and Install

```bash
git clone <repo-url>
cd now-signal
pnpm install
```

### 3. Setup Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Database (default works with docker-compose)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/now_signal"

# Better Auth (generate a secret)
BETTER_AUTH_SECRET="your-secret-here"
BETTER_AUTH_URL="http://localhost:3000"

# Firebase Client (from Firebase Console > Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_VAPID_KEY="..." # Cloud Messaging > Web Push certificates

# RSS Feeds
RSS_FEEDS="https://feeds.bbci.co.uk/news/world/rss.xml,https://rss.nytimes.com/services/xml/rss/nyt/World.xml"

# X/Twitter API v2 (for trending topics - optional)
TWITTER_BEARER_TOKEN="..." # Get from https://developer.twitter.com

# OpenAI (for AI-powered matching and threading - optional)
OPENAI_API_KEY="sk-..." # Get from https://platform.openai.com
```

### 4. Start Database

```bash
docker-compose up -d
```

### 5. Run Migrations

```bash
pnpm db:push
```

### 6. Start Development Server

```bash
pnpm dev
```

### 7. Start Inngest Dev Server (separate terminal)

```bash
pnpm inngest:dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Firebase Setup (Push Notifications)

### Client Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Cloud Messaging
3. Go to Project Settings > General > Your apps > Add web app
4. Copy the config values to your `.env` (NEXT_PUBLIC_FIREBASE_* variables)
5. Go to Cloud Messaging > Web Push certificates > Generate key pair
6. Copy the VAPID key to `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

### Service Worker Configuration

7. Edit `public/firebase-messaging-sw.js` and replace the placeholder values with your Firebase config:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID",
   };
   ```

### Server-side Admin SDK Configuration

#### Option A: Local Development (firebase-admin.json)

8. Go to Project Settings > Service accounts > Generate new private key
9. Download the JSON file
10. Rename it to `firebase-admin.json` and place it in your project root
11. This file is gitignored for security - never commit it to version control!

#### Option B: Production/Vercel (Environment Variables)

8. Go to Project Settings > Service accounts > Generate new private key
9. Download and open the JSON file
10. In Vercel dashboard > Your Project > Settings > Environment Variables, add:
    - `FIREBASE_ADMIN_PROJECT_ID` → copy `project_id` from JSON
    - `FIREBASE_ADMIN_CLIENT_EMAIL` → copy `client_email` from JSON
    - `FIREBASE_ADMIN_PRIVATE_KEY` → copy entire `private_key` from JSON (including `-----BEGIN/END PRIVATE KEY-----`)
11. The code will automatically use env vars if found, otherwise fallback to `firebase-admin.json`

**Important for FIREBASE_ADMIN_PRIVATE_KEY on Vercel:**
- Copy the entire private key including the BEGIN and END markers
- Vercel will handle the newlines automatically - just paste the value as-is from the JSON file

## Testing

### Generate Mock Signals

```bash
# Create 5 mock signals for testing
curl "http://localhost:3000/api/mock/publish?count=5&category=conflict&region=ME"

# Create a single mock signal
curl -X POST http://localhost:3000/api/mock/publish \
  -H "Content-Type: application/json" \
  -d '{"title": "Breaking: Major event detected", "category": "conflict", "regions": ["ME"]}'
```

### Manual Pipeline Trigger

The pipeline runs automatically every 10 minutes via Inngest. You can trigger it manually:

1. Open Inngest Dev UI at http://localhost:8288
2. Go to Functions > now-signal-manual
3. Send an event: `{ "name": "now-signal/manual-run", "data": {} }`

## Project Structure

```
├── app/
│   ├── (auth)/              # Auth pages (login, register)
│   ├── (dashboard)/         # Protected pages (dashboard, settings, events)
│   ├── api/
│   │   ├── auth/            # Better Auth handler
│   │   ├── devices/         # FCM device registration
│   │   ├── inngest/         # Inngest webhook
│   │   ├── mock/            # Mock signal generator
│   │   └── subscriptions/   # User subscription API
│   └── page.tsx             # Landing page
├── components/
│   ├── ui/                  # shadcn components
│   └── *.tsx                # App components
├── lib/
│   ├── db/                  # Drizzle schema and client
│   ├── ingest/              # RSS fetching and NER
│   ├── clustering/          # Event clustering and scoring
│   ├── inngest/             # Inngest functions
│   └── notifications/       # Push notification logic
├── public/
│   └── firebase-messaging-sw.js  # FCM service worker
└── drizzle/                 # Migration files
```

## Key Concepts

### Event Lifecycle

1. **Signal**: Raw data from RSS/mock sources
2. **Cluster**: Group of related signals (same category + region + time window)
3. **Status**:
   - `early`: High velocity/diversity but not yet confirmed
   - `watch`: Moderate signals, monitoring
   - `confirmed`: Multiple trusted sources confirm the event

### Scoring

- **Early Score** (0-100): velocity + diversity + urgency keywords
- **Confirm Score** (0-100): RSS source count + domain diversity + time spread

### Notification Rules

- **Deduplication**: Same cluster+type not sent within 30 min
- **Quiet Hours**: User-configurable time window
- **Daily Limit**: Max notifications per day per user
- **Major Updates**: Re-notify for significant changes (60 min cooldown)

## Scripts

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm db:generate  # Generate Drizzle migrations
pnpm db:push      # Push schema to database
pnpm db:studio    # Open Drizzle Studio
pnpm inngest:dev  # Start Inngest dev server
```

## License

MIT
