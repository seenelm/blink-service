# Blink Service

Backend service for the Blink dating app featuring WebRTC signaling, real-time matchmaking, and contact sharing.

## Features

- **WebRTC Signaling**: Handle offer/answer exchange for peer-to-peer video calls
- **Real-time Matchmaking**: Find and pair users for video chat sessions
- **Contact Sharing**: Exchange contact information when both users like each other
- **Authentication**: JWT-based authentication with Supabase
- **Rate Limiting**: Protect against abuse and ensure fair usage

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **WebRTC**: STUN servers for NAT traversal

## Setup

### Prerequisites

- Node.js 18+
- Supabase project with configured database

### Installation

1. Clone the repository and navigate to the service directory:

```bash
cd blink-service
```

2. Install dependencies:

```bash
npm install
```

3. Copy environment template and configure:

```bash
cp env.example .env
```

4. Update `.env` with your Supabase credentials:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Database Setup

Run the following SQL in your Supabase SQL editor:

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles with contact information
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  phone_number VARCHAR(20),
  instagram_handle VARCHAR(100),
  tiktok_handle VARCHAR(100),
  twitter_handle VARCHAR(100),
  linkedin_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User contacts (shared contact information)
CREATE TABLE user_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_name VARCHAR(255),
  phone_number VARCHAR(20),
  instagram_handle VARCHAR(100),
  tiktok_handle VARCHAR(100),
  twitter_handle VARCHAR(100),
  linkedin_url TEXT,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_user_id)
);

-- Row Level Security policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contacts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User contacts policies
CREATE POLICY "Users can view own contacts" ON user_contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts" ON user_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Development

Start the development server:

```bash
npm run dev
```

The server will run on `http://localhost:3001`

### Production

Build and start:

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

### WebRTC Configuration

```
GET /api/webrtc-config
Authorization: Bearer <jwt_token>
```

Returns STUN server configuration for WebRTC.

## Socket.IO Events

### Client to Server

- `user:join` - Join waiting room for matchmaking
- `webrtc:offer` - Send WebRTC offer to partner
- `webrtc:answer` - Send WebRTC answer to partner
- `webrtc:ice-candidate` - Send ICE candidate to partner
- `call:like` - Express interest in partner
- `call:dislike` - Decline partner
- `call:end` - End call prematurely

### Server to Client

- `match:found` - Notify users of successful match
- `webrtc:offer` - Receive WebRTC offer from partner
- `webrtc:answer` - Receive WebRTC answer from partner
- `webrtc:ice-candidate` - Receive ICE candidate from partner
- `contact:shared` - Notify of mutual like and contact sharing
- `call:end` - Notify of call ending

## Authentication

All Socket.IO connections require a valid JWT token from Supabase Auth:

```javascript
const socket = io("http://localhost:3001", {
  auth: {
    token: "your_supabase_jwt_token",
  },
});
```

## Environment Variables

| Variable                    | Description               | Default                         |
| --------------------------- | ------------------------- | ------------------------------- |
| `PORT`                      | Server port               | 3001                            |
| `SUPABASE_URL`              | Supabase project URL      | Required                        |
| `SUPABASE_ANON_KEY`         | Supabase anonymous key    | Required                        |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Required                        |
| `STUN_SERVER_1`             | Primary STUN server       | `stun:stun.l.google.com:19302`  |
| `STUN_SERVER_2`             | Secondary STUN server     | `stun:stun1.l.google.com:19302` |
| `RATE_LIMIT_WINDOW_MS`      | Rate limit window         | 900000 (15 min)                 |
| `RATE_LIMIT_MAX_REQUESTS`   | Max requests per window   | 100                             |
| `CORS_ORIGIN`               | Allowed CORS origins      | `http://localhost:3000`         |

## Testing

Run tests:

```bash
npm test
```

## Linting

Check code quality:

```bash
npm run lint
```

Fix issues:

```bash
npm run lint:fix
```
