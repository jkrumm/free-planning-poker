import os
import time
from dotenv import load_dotenv

from flask import Flask, request, abort
from flask_wtf.csrf import CSRFProtect

from config import ANALYTICS_SECRET_TOKEN, DATA_DIR
from room.calc_room_stats import calc_room_stats
from scripts.calc_behaviour import calc_behaviour
from scripts.calc_daily_analytics import calc_daily_analytics
from scripts.calc_historical import calc_historical
from scripts.calc_location_and_user_agent import calc_location_and_user_agent
from scripts.calc_reoccurring import calc_reoccurring
from scripts.calc_traffic import calc_traffic
from scripts.calc_votes import calc_votes
from scripts.update_read_model import update_read_model, load_landingpage_analytics
from util.log_util import logger
from util.number_util import r
from util.send_email_util import send_email_util

app = Flask(__name__)
csrf = CSRFProtect(app)

load_dotenv()


@app.route("/")
def run_script():
    start_time = time.time()
    token = request.headers.get('Authorization')

    if token != ANALYTICS_SECRET_TOKEN or ANALYTICS_SECRET_TOKEN is None:
        logger.error("Unauthorized request", {"token": token})
        abort(401)

    results = {}
    failed_reason = None

    try:
        update_read_model()
    except Exception as e:
        logger.error("Script update_read_model failed", {"error": e})
        failed_reason = "update_read_model"

    if failed_reason:
        logger.flush()
        return {"error": failed_reason}

    try:
        results["traffic"] = calc_traffic()
    except Exception as e:
        logger.error("Script calc_traffic failed", {"error": e})
        failed_reason = "calc_traffic"

    try:
        results["votes"] = calc_votes()
    except Exception as e:
        logger.error("Script calc_votes failed", {"error": e})
        failed_reason = "calc_votes"

    try:
        results["behaviour"] = calc_behaviour()
    except Exception as e:
        logger.error("Script calc_behaviour failed", {"error": e})
        failed_reason = "calc_behaviour"

    try:
        results["reoccurring"] = calc_reoccurring()
    except Exception as e:
        logger.error("Script calc_reoccurring failed", {"error": e})
        failed_reason = "calc_reoccurring"

    try:
        results["historical"] = calc_historical()
    except Exception as e:
        logger.error("Script calc_historical failed", {"error": e})
        failed_reason = "calc_historical"

    try:
        results["location_and_user_agent"] = calc_location_and_user_agent()
    except Exception as e:
        logger.error("Script calc_location_and_user_agent failed", {"error": e})
        failed_reason = "calc_location_and_user_agent"

    duration = r(time.time() - start_time)

    if failed_reason:
        logger.flush()
        return {"error": failed_reason, "duration": duration}

    data_size_in_gb = round(sum(
        os.path.getsize(os.path.join(DATA_DIR, f))
        for f in os.listdir(DATA_DIR)
        if os.path.isfile(os.path.join(DATA_DIR, f))
    ) / 1024 / 1024 / 1024, 2)
    logs_size_in_gb = r(sum(
        os.path.getsize(f"./logs/{f}") for f in os.listdir("./logs") if os.path.isfile(f"./logs/{f}")) / 1024 / 1024)
    logger.info("Script executed successfully!",
                {"duration": duration, "data_size_in_gb": data_size_in_gb, "logs_size": logs_size_in_gb})

    logger.flush()

    return results


@app.route("/room/<room_id>/stats")
def get_room_stats(room_id):
    start_time = time.time()
    token = request.headers.get('Authorization')

    if token != ANALYTICS_SECRET_TOKEN or ANALYTICS_SECRET_TOKEN is None:
        logger.error("Unauthorized request", {"token": token})
        abort(401)

    if room_id is None or room_id == "":
        logger.error("Room ID is missing")
        abort(400)

    try:
        room_stats = calc_room_stats(room_id)
    except Exception as e:
        print(e)
        logger.error("calc_room_stats failed", {"error": e})
        logger.flush()
        abort(500)

    duration = r(time.time() - start_time)
    logger.info("calc_room_stats successfully", {"duration": duration})
    logger.flush()

    return room_stats


@app.route("/landingpage-analytics")
def get_landingpage_analytics():
    start_time = time.time()
    token = request.headers.get('Authorization')

    if token != ANALYTICS_SECRET_TOKEN or ANALYTICS_SECRET_TOKEN is None:
        logger.error("Unauthorized request", {"token": token})
        abort(401)

    try:
        landingpage_analytics = load_landingpage_analytics()
    except Exception as e:
        logger.error("Script load_landingpage_analytics failed", {"error": e})
        logger.flush()
        return {"msg": "Script load_landingpage_analytics failed", "error": str(e),
                "duration": r(time.time() - start_time)}

    logger.info("landingpage-analytics successfully",
                {"duration": r(time.time() - start_time), "landingpage_analytics": landingpage_analytics})
    logger.flush()
    
    return landingpage_analytics


@app.route("/daily-analytics")
def run_daily_analytics():
    start_time = time.time()
    token = request.headers.get('Authorization')

    if token != ANALYTICS_SECRET_TOKEN or ANALYTICS_SECRET_TOKEN is None:
        logger.error("Unauthorized request", {"token": token})
        abort(401)

    try:
        update_read_model()
    except Exception as e:
        logger.error("Script update_read_model failed", {"error": e})
        logger.flush()
        return {"msg": "Script update_read_model failed", "error": str(e), "duration": r(time.time() - start_time)}

    try:
        daily_analytics = calc_daily_analytics()
    except Exception as e:
        logger.error("Script calc_daily_analytics failed", {"error": e})
        logger.flush()
        return {"msg": "Script calc_daily_analytics failed", "error": str(e), "duration": r(time.time() - start_time)}

    try:
        send_email_util("fpp-daily-analytics", daily_analytics)
    except Exception as e:
        logger.error("Script send_email_util failed", {"error": e})
        logger.flush()
        return {"msg": "Script send_email_util failed", "error": str(e), "duration": r(time.time() - start_time)}

    logger.info("daily-analytics successfully", {"duration": r(time.time() - start_time)})
    logger.flush()

    return daily_analytics
