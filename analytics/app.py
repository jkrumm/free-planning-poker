import os
import time
from dotenv import load_dotenv

from flask import Flask, request, abort
from flask_wtf.csrf import CSRFProtect

from scripts.calc_behaviour import calc_behaviour
from scripts.calc_historical import calc_historical
from scripts.calc_location_and_user_agent import calc_location_and_user_agent
from scripts.calc_traffic import calc_traffic
from scripts.calc_votes import calc_votes
from scripts.update_read_model import update_read_model
from util.log_util import logger
from util.number_util import r

app = Flask(__name__)
csrf = CSRFProtect(app)

load_dotenv()
ANALYTICS_SECRET_TOKEN = os.getenv("ANALYTICS_SECRET_TOKEN")


@app.route("/")
def run_script():
    token = request.headers.get('Authorization')

    if token != ANALYTICS_SECRET_TOKEN or ANALYTICS_SECRET_TOKEN is None:
        abort(401)

    start_time = time.time()

    results = {}

    try:
        update_read_model()
    except Exception as e:
        logger.error(f"Script update_read_model failed", {"error": e})

    try:
        results["traffic"] = calc_traffic()
    except Exception as e:
        logger.error(f"Script calc_traffic failed", {"error": e})

    try:
        results["votes"] = calc_votes()
    except Exception as e:
        logger.error(f"Script calc_votes failed", {"error": e})

    try:
        results["behaviour"] = calc_behaviour()
    except Exception as e:
        logger.error(f"Script calc_behaviour failed", {"error": e})

    try:
        results["historical"] = calc_historical()
    except Exception as e:
        logger.error(f"Script calc_historical failed", {"error": e})

    try:
        results["location_and_user_agent"] = calc_location_and_user_agent()
    except Exception as e:
        logger.error(f"Script calc_location_and_user_agent failed", {"error": e})

    duration = r(time.time() - start_time)
    data_size_in_gb = r(sum(
        os.path.getsize(f"./data/{f}") for f in os.listdir("./data") if os.path.isfile(f"./data/{f}")) / 1024 / 1024)
    logs_size_in_gb = r(sum(
        os.path.getsize(f"./logs/{f}") for f in os.listdir("./logs") if os.path.isfile(f"./logs/{f}")) / 1024 / 1024)
    logger.info("Script executed successfully!",
                {"duration": duration, "data_size_in_gb": data_size_in_gb, "logs_size": logs_size_in_gb})

    logger.flush()

    return results
