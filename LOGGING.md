# Logging Architecture

## Common Log Schema

All services use structured JSON logging with consistent fields:

```json
{
  "level": 30,                    // 20=debug, 30=info, 40=warn, 50=error, 60=fatal
  "time": 1767356472092,          // Unix timestamp (ms)
  "service": "free-planning-poker", // Service identifier
  "component": "trpcHandler",     // Code component/module
  "action": "createRoom",         // Function/action name
  "msg": "Room created",          // Human-readable message

  // Optional fields:
  "userId": "abc123",
  "roomId": 42,
  "duration": 123,                // Request duration in ms
  "status": 200,                  // HTTP status code
  "error": {                      // Error details (level >= 50)
    "name": "Error",
    "message": "Something went wrong",
    "code": "INTERNAL_SERVER_ERROR",
    "stack": "Error: ...\n  at ..."
  }
}
```

---

## Error Logging by Service

### Next.js (free-planning-poker)

**Location:** `src/utils/app-error.ts`

**Error format:**
```json
{
  "level": 50,
  "time": 1767356472092,
  "service": "free-planning-poker",
  "component": "roomRouter",
  "action": "createRoom",
  "severity": "high",
  "error": {
    "name": "TRPCError",
    "message": "Database connection failed",
    "code": "INTERNAL_SERVER_ERROR",
    "stack": "Error: ...\n  at ..."
  },
  "userId": "abc123",
  "roomId": 42,
  "msg": "[high] roomRouter:createRoom - Database connection failed"
}
```

**Usage:**
```typescript
import { captureError } from 'fpp/utils/app-error';

try {
  // Some operation
} catch (error) {
  captureError(
    error as Error,
    {
      component: 'roomRouter',
      action: 'createRoom',
      extra: { userId, roomId }
    },
    'high'
  );
}
```

---

### fpp-server (WebSocket)

**Location:** `fpp-server/src/utils/app-error.ts`

**Error format:**
```json
{
  "level": 50,
  "time": 1767356472092,
  "service": "fpp-server",
  "component": "messageHandler",
  "action": "handleVote",
  "severity": "high",
  "error": {
    "name": "Error",
    "message": "Room not found",
    "stack": "Error: ...\n  at ..."
  },
  "roomId": 42,
  "userId": "abc123",
  "msg": "[high] messageHandler:handleVote - Room not found"
}
```

**Usage:**
```typescript
import { captureError } from './utils/app-error';

try {
  // Some operation
} catch (error) {
  captureError(
    error as Error,
    {
      component: 'messageHandler',
      action: 'handleVote',
      extra: { roomId, userId }
    },
    'high'
  );
}
```

---

### fpp-analytics (FastAPI)

**Location:** `fpp-analytics/util/sentry_wrapper.py`

**Error format:**
```json
{
  "level": 50,
  "time": 1767356472092,
  "service": "fpp-analytics",
  "component": "analytics_router",
  "action": "get_analytics",
  "severity": "high",
  "error": {
    "type": "FileNotFoundError",
    "message": "Parquet file not found",
    "traceback": "Traceback (most recent call last):\n..."
  },
  "userId": "abc123",
  "msg": "[high] analytics_router:get_analytics - Parquet file not found"
}
```

**Usage:**
```python
from util.sentry_wrapper import ErrorContext, capture_error

try:
    # Some operation
except Exception as e:
    capture_error(
        e,
        ErrorContext(
            component='analytics_router',
            action='get_analytics',
            extra={'user_id': user_id}
        ),
        severity='high'
    )
```

---

## Log Levels

| Level | Name | Description | When to Use |
|-------|------|-------------|-------------|
| 20 | debug | Verbose debugging | Development only |
| 30 | info | Normal operation | Successful requests, state changes |
| 40 | warn | Warning | 4xx HTTP errors, business logic failures |
| 50 | error | Error | 5xx HTTP errors, system failures |
| 60 | fatal | Fatal | Service crash, unrecoverable errors |

---

## Logdy Display Configuration

Create `logdy.config.json` in project root:

```json
{
  "columns": [
    {
      "id": "time",
      "label": "Time",
      "width": 180,
      "format": "timestamp"
    },
    {
      "id": "level",
      "label": "Level",
      "width": 80,
      "format": "level",
      "colorize": true
    },
    {
      "id": "service",
      "label": "Service",
      "width": 150
    },
    {
      "id": "component",
      "label": "Component",
      "width": 150
    },
    {
      "id": "msg",
      "label": "Message",
      "width": 400
    },
    {
      "id": "duration",
      "label": "Duration (ms)",
      "width": 100,
      "format": "number"
    },
    {
      "id": "status",
      "label": "Status",
      "width": 80
    },
    {
      "id": "error.message",
      "label": "Error",
      "width": 300
    }
  ],
  "filters": {
    "default": [
      {
        "field": "level",
        "operator": ">=",
        "value": 30
      }
    ]
  }
}
```

**To use the config:**
```bash
# Update package.json dev:all:logdy script
"dev:all:logdy": "logdy socket --port 8080 8081 8082 8083 --config logdy.config.json"
```

---

## Searching and Filtering

### Common Queries

**By service:**
- `service:free-planning-poker`
- `service:fpp-server`
- `service:fpp-analytics`

**By log level:**
- `level:50` (errors only)
- `level:>=40` (warnings and errors)

**By component:**
- `component:trpcHandler`
- `component:messageHandler`
- `component:httpRequest`

**Errors only:**
- `error.message:*` (any error with message)
- `level:50` (error level)

**By user/room:**
- `userId:abc123`
- `roomId:42`

**Performance:**
- `duration:>1000` (requests slower than 1s)
- `status:500` (500 errors)

---

## Production Considerations

### Log Volume
- **Info logs:** ~100-500/min per service (development)
- **Error logs:** <1% of total (healthy system)
- Estimated production: ~10K-50K logs/day across all services

### Retention
- Local (Logdy): Session-based (lost on restart)
- Production: Configure based on compliance needs (30-90 days typical)

### Performance Impact
- JSON serialization: <1ms overhead per log
- Async writes: Non-blocking (Pino default)
- Log volume: Minimal impact (<0.1% CPU)

---

## Troubleshooting

### Missing `msg` Field
If you see logs with empty `msg` field:
- Check that log calls include a message string
- Python: Ensure `logger.info(message, extra={...})` format
- TypeScript: Ensure second parameter is the message: `logger.info({...}, 'message')`

### Logs Not Appearing in Logdy
1. Check Logdy socket is running: `lsof -i :8080`
2. Check forward connections: `lsof -i :8081,8082,8083`
3. Verify services are outputting JSON: `npm run dev` (check terminal)

### Log Parsing Issues
- Ensure all logs are valid JSON (no multiline strings)
- Check for special characters in log messages (escape properly)
- Verify timestamp is in milliseconds (not seconds)
