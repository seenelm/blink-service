# Blink Service

Backend service for the Blink dating app, providing real-time video chat functionality with WebRTC signaling and intelligent matchmaking.

## Features

- **Real-time Communication**: WebSocket-based real-time messaging
- **Video Chat**: WebRTC signaling for peer-to-peer video calls
- **Matchmaking**: Intelligent user matching algorithm
- **Authentication**: Supabase Auth integration
- **Scalable**: Built for high-performance and scalability
- **Secure**: Rate limiting, CORS, and security headers

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: WebSocket (ws)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Language**: TypeScript

## Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Start development server**:

   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebRTC Configuration
STUN_SERVER_1=stun:stun.l.google.com:19302
STUN_SERVER_2=stun:stun1.l.google.com:19302
```

## API Endpoints

### Health Check

- `GET /health` - Server health status

### Debug Endpoints

- `GET /debug/waiting-room` - Current waiting room statistics
- `GET /debug/websocket-stats` - WebSocket connection statistics

### Protected Endpoints

- `GET /api/webrtc-config` - WebRTC ICE server configuration

## WebSocket Events

### Client to Server

#### Authentication

All WebSocket connections require a valid JWT token from Supabase Auth:

```javascript
// Connect with authentication
const ws = new WebSocket("ws://localhost:3001");
ws.onopen = () => {
  // Send authentication header
  ws.send(
    JSON.stringify({
      type: "auth",
      token: "your_supabase_jwt_token",
    })
  );
};
```

#### Join Waiting Room

```javascript
ws.send(
  JSON.stringify({
    type: "user:join",
  })
);
```

#### Call Actions

```javascript
// Like partner
ws.send(
  JSON.stringify({
    type: "call:like",
    partnerId: "partner_user_id",
  })
);

// Dislike partner
ws.send(
  JSON.stringify({
    type: "call:dislike",
    partnerId: "partner_user_id",
  })
);

// End call
ws.send(
  JSON.stringify({
    type: "call:end",
  })
);
```

#### WebRTC Signaling

```javascript
// Send offer
ws.send(
  JSON.stringify({
    type: "webrtc:offer",
    targetId: "partner_user_id",
    offer: rtcOffer,
  })
);

// Send answer
ws.send(
  JSON.stringify({
    type: "webrtc:answer",
    targetId: "partner_user_id",
    answer: rtcAnswer,
  })
);

// Send ICE candidate
ws.send(
  JSON.stringify({
    type: "webrtc:ice-candidate",
    targetId: "partner_user_id",
    candidate: iceCandidate,
  })
);
```

### Server to Client

#### Connection Events

```javascript
// Connection established
{
  type: 'connection:established',
  socketId: 'socket_id',
  userId: 'user_id'
}

// Waiting room joined
{
  type: 'waiting:joined',
  message: 'Waiting for a match...'
}
```

#### Match Events

```javascript
// Match found
{
  type: 'match:found',
  partnerId: 'partner_user_id',
  partnerSocketId: 'partner_socket_id'
}
```

#### Call Events

```javascript
// Call ended
{
  type: 'call:ended',
  message: 'Call ended successfully'
}

// Contact shared (mutual like)
{
  type: 'contact:shared',
  data: {
    id: 'contact_id',
    name: 'Partner Name',
    email: 'partner@email.com',
    // ... other contact info
  }
}
```

#### WebRTC Events

```javascript
// Receive offer
{
  type: 'webrtc:offer',
  offer: rtcOffer,
  fromId: 'sender_user_id'
}

// Receive answer
{
  type: 'webrtc:answer',
  answer: rtcAnswer,
  fromId: 'sender_user_id'
}

// Receive ICE candidate
{
  type: 'webrtc:ice-candidate',
  candidate: iceCandidate,
  fromId: 'sender_user_id'
}
```

#### Error Events

```javascript
{
  type: 'error',
  message: 'Error description'
}
```

## Architecture

### WebSocket Manager

The `WebSocketManager` class handles all real-time communication:

- **Connection Management**: Authenticates and manages WebSocket connections
- **Message Routing**: Routes messages to appropriate handlers
- **Heartbeat**: Maintains connection health with ping/pong
- **Cleanup**: Automatically removes stale connections

### Matchmaking Service

The `MatchmakingService` manages user matching:

- **Waiting Room**: Tracks users waiting for matches
- **Matching Algorithm**: Pairs compatible users
- **Session Management**: Manages active call sessions

### Call Service

The `CallService` handles call-related operations:

- **Like/Dislike**: Processes user preferences
- **Contact Sharing**: Manages mutual like scenarios
- **Call Sessions**: Tracks active video calls

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

### Project Structure

```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── services/        # Business logic services
├── websocket/       # WebSocket manager and handlers
└── index.ts         # Main application entry point
```

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Variables

Ensure all required environment variables are set in production.

### Health Checks

The service provides health check endpoints for monitoring:

- `GET /health` - Basic health status
- `GET /debug/waiting-room` - Matchmaking status
- `GET /debug/websocket-stats` - Connection statistics

## Security

- **Authentication**: All WebSocket connections require valid JWT tokens
- **Rate Limiting**: Configurable rate limiting on HTTP endpoints
- **CORS**: Proper CORS configuration for cross-origin requests
- **Security Headers**: Helmet.js for security headers
- **Input Validation**: Proper message validation and sanitization

## Monitoring

### Logs

The service provides comprehensive logging:

- Connection events
- Message routing
- Error tracking
- Performance metrics

### Debug Endpoints

Use the debug endpoints to monitor service health:

- `/debug/waiting-room` - Check waiting room status
- `/debug/websocket-stats` - Monitor WebSocket connections

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
