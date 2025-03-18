import os
import time
from dotenv import load_dotenv
import shutil
import concurrent.futures

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
from scripts.update_read_model import update_read_model, load_landingpage_analytics, check_db_health, \
    update_votes_read_model
from util.log_util import logger
from util.number_util import r
from util.send_email_util import send_email_util

def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__)
    
    # load environment variables
    load_dotenv()
    
    # configure CSRF protection
    csrf = CSRFProtect(app)
    
    # Initialize the app
    start_time = time.time()
    logger.info("Initializing analytics app...")
    try:
        # Clear existing parquet files
        for file in os.listdir(DATA_DIR):
            if file.endswith('.parquet'):
                os.remove(os.path.join(DATA_DIR, file))
        
        # Rebuild read model from scratch
        update_read_model()
        duration = r(time.time() - start_time)
        logger.info("Successfully initialized read model", {"duration": duration})
    except Exception as e:
        duration = r(time.time() - start_time)
        logger.error("Failed to initialize read model", {"error": str(e), "duration": duration})
    finally:
        logger.flush()

    @app.route("/health")
    def health():
        start_time = time.time()
        health_status = {
            "status": "ok",
            "components": check_db_health()
        }

        # update read model and add the result to the health status
        try:
            update_read_model()
            health_status["components"]["read_model"] = True
        except Exception as e:
            health_status["components"]["read_model"] = False
            health_status["components"]["read_model_error"] = str(e)

        # Calculate data and logs size
        try:
            data_size_in_gb = round(sum(
                os.path.getsize(os.path.join(DATA_DIR, f))
                for f in os.listdir(DATA_DIR)
                if os.path.isfile(os.path.join(DATA_DIR, f))
            ) / 1024 / 1024 / 1024, 2)
            logs_size_in_gb = r(sum(
                os.path.getsize(f"./logs/{f}") for f in os.listdir("./logs") if os.path.isfile(f"./logs/{f}")) / 1024 / 1024)
            health_status["components"]["storage"] = {
                "data_size_in_gb": data_size_in_gb,
                "logs_size_in_gb": logs_size_in_gb
            }
        except Exception as e:
            health_status["components"]["storage"] = {
                "error": str(e)
            }

        # If any component is unhealthy, change status and return 503
        if not health_status["components"]["database"]["connected"] or not health_status["components"]["read_model"]:
            health_status["status"] = "error"
            return health_status, 503

        duration = r(time.time() - start_time)
        health_status["duration"] = duration
        return health_status

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

        # Define calculation tasks
        calculation_tasks = {
            "traffic": calc_traffic,
            "votes": calc_votes,
            "behaviour": calc_behaviour,
            "reoccurring": calc_reoccurring,
            "historical": calc_historical,
            "location_and_user_agent": calc_location_and_user_agent
        }

        # Run calculations in parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_to_task = {executor.submit(func): (name, func) for name, func in calculation_tasks.items()}
            
            for future in concurrent.futures.as_completed(future_to_task):
                task_name, func = future_to_task[future]
                try:
                    results[task_name] = future.result()
                except Exception as e:
                    logger.error(f"Script {task_name} failed", {"error": e})
                    failed_reason = task_name

        duration = r(time.time() - start_time)

        if failed_reason:
            logger.flush()
            return {"error": failed_reason, "duration": duration}

        logger.info("Script executed successfully!", {"duration": duration})
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

    return app

# Create the app instance
app = create_app()
