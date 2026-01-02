"""HTTP client for external services using httpx."""

from typing import Any

import httpx

from config import BEA_BASE_URL, BEA_SECRET_KEY
from util.sentry_wrapper import ErrorContext, capture_error


class EmailServiceError(Exception):
    """Error communicating with email service."""

    pass


async def send_daily_email(daily_analytics: dict[str, Any]) -> None:
    """Send daily analytics email via BEA service.

    Raises:
        EmailServiceError: If email service request fails
    """
    if not BEA_BASE_URL or not BEA_SECRET_KEY:
        print("BEA service not configured, skipping email")
        return

    url = f"http://{BEA_BASE_URL}:3010/fpp-daily-analytics"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {BEA_SECRET_KEY}",
                },
                json=daily_analytics,
                timeout=30.0,
            )

            if response.status_code != 200:
                error = EmailServiceError(
                    f"Email service returned status {response.status_code}"
                )
                capture_error(
                    error,
                    ErrorContext(
                        component="http_client",
                        action="send_daily_email",
                        extra={
                            "url": url,
                            "status_code": response.status_code,
                            "response_text": response.text[:200],
                        },
                    ),
                    severity="medium",
                )
                raise error

    except httpx.TimeoutException as e:
        capture_error(
            e,
            ErrorContext(
                component="http_client",
                action="send_daily_email",
                extra={"url": url, "timeout": 30.0},
            ),
            severity="medium",
        )
        raise EmailServiceError("Email service request timed out") from e

    except httpx.RequestError as e:
        capture_error(
            e,
            ErrorContext(
                component="http_client",
                action="send_daily_email",
                extra={"url": url, "error_type": type(e).__name__},
            ),
            severity="medium",
        )
        raise EmailServiceError(f"Email service request failed: {e}") from e
