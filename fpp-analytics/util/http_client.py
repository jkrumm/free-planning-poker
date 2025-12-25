"""HTTP client for external services using httpx."""
import httpx
from config import BEA_BASE_URL, BEA_SECRET_KEY


async def send_daily_email(daily_analytics: dict) -> None:
    """Send daily analytics email via BEA service."""
    if not BEA_BASE_URL or not BEA_SECRET_KEY:
        print("BEA service not configured, skipping email")
        return

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"http://{BEA_BASE_URL}:3010/fpp-daily-analytics",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {BEA_SECRET_KEY}"
            },
            json=daily_analytics,
            timeout=30.0
        )

        if response.status_code != 200:
            raise Exception(f"Failed to send email with status {response.status_code}")
