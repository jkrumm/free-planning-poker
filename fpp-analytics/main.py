from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Header
import sentry_sdk

from routers import analytics, room, health
from config import SENTRY_DSN, SENTRY_ENVIRONMENT, ANALYTICS_SECRET_TOKEN


def verify_auth(authorization: str = Header(None)):
    """Verify Bearer token authentication."""
    if not ANALYTICS_SECRET_TOKEN:
        raise HTTPException(status_code=500, detail="Auth not configured")
    if not authorization or authorization != ANALYTICS_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Sentry
    if SENTRY_DSN:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=SENTRY_ENVIRONMENT,
            traces_sample_rate=0.1,
            profiles_sample_rate=0.1,
            # Filter out health check transactions
            before_send_transaction=lambda event, hint: (
                None if event.get("transaction") == "/health" else event
            ),
        )
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title="FPP Analytics API",
    version="2.0.0",
    lifespan=lifespan,
)

# Public health check (no auth)
app.include_router(health.router)

# Authenticated analytics routes
app.include_router(
    analytics.router,
    dependencies=[Depends(verify_auth)]
)
app.include_router(
    room.router,
    prefix="/room",
    dependencies=[Depends(verify_auth)]
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5100)
