import pandas as pd

from util.log_util import logger


def calc_location_and_user_agent():
    # load user data with columns 'user_id' and 'location'
    df_users = pd.read_parquet("./data/fpp_users.parquet",
                               columns=["device", "os", "browser", "country", "region", "city"])

    device = df_users.groupby("device", observed=False).size().to_dict()

    os = df_users.groupby("os", observed=False).size().to_dict()

    browser = df_users.groupby("browser", observed=False).size().to_dict()

    country = df_users.groupby("country", observed=False).size().to_dict()

    region = df_users.groupby("region", observed=False).size().to_dict()

    city = df_users.groupby("city", observed=False).size().to_dict()

    location_and_user_agent = {
        "device": device,
        "os": os,
        "browser": browser,
        "country": country,
        "region": region,
        "city": city
    }

    logger.debug("Location and user agent calculated", location_and_user_agent)

    return location_and_user_agent
