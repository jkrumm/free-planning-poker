import os
import pandas as pd

from config import DATA_DIR
from util.log_util import logger


def calc_location_and_user_agent():
    # load user data with columns 'user_id' and 'location'
    df_users = pd.read_parquet(os.path.join(DATA_DIR, "fpp_users.parquet"),
                               columns=["device", "os", "browser", "country", "region", "city"])

    device = df_users.groupby("device", observed=False).size().to_dict()

    operating_system = df_users.groupby("os", observed=False).size().to_dict()

    browser = df_users.groupby("browser", observed=False).size().to_dict()

    country = df_users.groupby("country", observed=False).size().to_dict()

    # find the country of each region
    country_region = df_users.groupby(["country", "region"], observed=False).size().reset_index(name="count")
    country_region = country_region.to_dict(orient="records")

    # find the country of each city
    country_city = df_users.groupby(["country", "city"], observed=False).size().reset_index(name="count")
    country_city = country_city.to_dict(orient="records")

    location_and_user_agent = {
        "device": device,
        "os": operating_system,
        "browser": browser,
        "country": country,
        "country_region": country_region,
        "country_city": country_city
    }

    logger.debug("Location and user agent calculated", location_and_user_agent)

    return location_and_user_agent
