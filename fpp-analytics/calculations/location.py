"""Location and user agent analytics using Polars."""
import polars as pl
from pathlib import Path
from config import DATA_DIR

TOP_N = 40


def calc_location_and_user_agent() -> dict:
    """Calculate location and user agent breakdown."""
    data_dir = Path(DATA_DIR)

    # Load user data
    df_users = pl.read_parquet(
        data_dir / "fpp_users.parquet",
        columns=["device", "os", "browser", "country", "region", "city"]
    )

    # Device breakdown
    device = dict(
        df_users.group_by("device")
        .len()
        .iter_rows()
    )

    # OS breakdown
    operating_system = dict(
        df_users.group_by("os")
        .len()
        .iter_rows()
    )

    # Browser breakdown
    browser = dict(
        df_users.group_by("browser")
        .len()
        .iter_rows()
    )

    # Country breakdown (top N by count)
    country = dict(
        df_users.group_by("country")
        .len()
        .sort("len", descending=True)
        .head(TOP_N)
        .iter_rows()
    )

    # Country-region breakdown (top N by count)
    country_region = (
        df_users.group_by(["country", "region"])
        .len()
        .rename({"len": "count"})
        .sort("count", descending=True)
        .head(TOP_N)
        .to_dicts()
    )

    # Country-city breakdown (top N by count)
    country_city = (
        df_users.group_by(["country", "city"])
        .len()
        .rename({"len": "count"})
        .sort("count", descending=True)
        .head(TOP_N)
        .to_dicts()
    )

    return {
        "device": device,
        "os": operating_system,
        "browser": browser,
        "country": country,
        "country_region": country_region,
        "country_city": country_city
    }
