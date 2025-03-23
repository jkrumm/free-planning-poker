import os
import time
from datetime import datetime
from dotenv import load_dotenv
import shutil
from pytz import utc

from flask import Flask, request, abort
from flask_wtf.csrf import CSRFProtect
from flask_apscheduler import APScheduler
from apscheduler.schedulers.background import BackgroundScheduler

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

# Global cache for analytics results
analytics_cache = {
    "data": None,
    "last_updated": None
}

class Config:
    """Flask-APScheduler configuration"""
    SCHEDULER_API_ENABLED = False
    SCHEDULER_TIMEZONE = utc
    SCHEDULER_JOB_DEFAULTS = {
        'coalesce': True,
        'max_instances': 1,
        'misfire_grace_time': 15
    }

def update_analytics_cache():
    """Update the analytics cache with fresh calculations"""
    logger.debug("Starting scheduled analytics cache update")
    try:
        # Update read model first
        logger.debug("Updating read model...")
        update_read_model()
        logger.flush()  # Flush after read model update
        
        # Run all calculations sequentially
        logger.debug("Running calculations...")
        results = {
            "traffic": calc_traffic(),
            "votes": calc_votes(),
            "behaviour": calc_behaviour(),
            "reoccurring": calc_reoccurring(),
            "historical": calc_historical(),
            "location_and_user_agent": calc_location_and_user_agent()
        }
        logger.flush()  # Flush after calculations
        
        # Update cache with UTC timestamp
        analytics_cache["data"] = results
        analytics_cache["last_updated"] = datetime.now(utc)
        logger.debug("Analytics cache updated successfully")
        logger.flush()  # Flush after cache update
    except Exception as e:
        logger.error("Failed to update analytics cache", {"error": str(e)})
        logger.flush()  # Flush after error

def init_scheduler(app):
    """Initialize the APScheduler with the app"""
    scheduler = APScheduler()
    scheduler.init_app(app)
    
    # Add the job before starting
    scheduler.add_job(
        id='update_analytics_cache',
        func=update_analytics_cache,
        trigger='interval',
        seconds=30
    )
    
    scheduler.start()
    logger.info("Analytics scheduler started")  # Keep this as INFO as it's a significant system event
    logger.flush()
    return scheduler

def create_app(test_config=None):
    """Application factory function"""
    # create and configure the app
    app = Flask(__name__)
    app.config.from_object(Config())
    
    # load environment variables
    load_dotenv()
    
    # configure CSRF protection
    csrf = CSRFProtect(app)
    
    # Initialize the app
    start_time = time.time()
    logger.info("Initializing analytics app...")  # Keep this as INFO as it's a significant system event
    try:
        # Clear existing parquet files
        logger.debug("Clearing parquet files...")
        for file in os.listdir(DATA_DIR):
            if file.endswith('.parquet'):
                os.remove(os.path.join(DATA_DIR, file))
        
        # Initial cache update
        logger.debug("Running initial cache update...")
        update_analytics_cache()
        
        # Initialize and start the scheduler
        init_scheduler(app)
        
        duration = r(time.time() - start_time)
        logger.info("Analytics app initialized successfully", {"duration": duration})  # Keep as INFO
    except Exception as e:
        duration = r(time.time() - start_time)
        logger.error("Failed to initialize app", {"error": str(e), "duration": duration})
    finally:
        logger.flush()

    @app.route("/health")
    def health():
        start_time = time.time()
        health_status = {
            "status": "ok",
            "components": check_db_health()
        }

        # Check cache health
        if analytics_cache["last_updated"] is None:
            health_status["components"]["cache"] = {
                "status": "error",
                "error": "Cache not initialized"
            }
        else:
            cache_age = (datetime.now(utc) - analytics_cache["last_updated"]).total_seconds()
            if cache_age > 180:  # 3 minutes
                health_status["components"]["cache"] = {
                    "status": "error",
                    "error": f"Cache is stale ({int(cache_age)}s old)"
                }
            else:
                health_status["components"]["cache"] = {
                    "status": "ok",
                    "last_updated": analytics_cache["last_updated"].isoformat(),
                    "age_seconds": int(cache_age)
                }

        # Calculate data and logs size
        try:
            # Use absolute paths
            data_dir = os.path.abspath(DATA_DIR)
            logs_dir = os.path.abspath("./logs")
            
            # Calculate data size
            data_files = [f for f in os.listdir(data_dir) if os.path.isfile(os.path.join(data_dir, f))]
            data_size_bytes = sum(os.path.getsize(os.path.join(data_dir, f)) for f in data_files)
            data_size_in_gb = round(data_size_bytes / (1024 * 1024 * 1024), 3)
            
            # Calculate logs size
            log_files = [f for f in os.listdir(logs_dir) if os.path.isfile(os.path.join(logs_dir, f))]
            logs_size_bytes = sum(os.path.getsize(os.path.join(logs_dir, f)) for f in log_files)
            logs_size_in_gb = round(logs_size_bytes / (1024 * 1024 * 1024), 3)
            
            # Log details for verification
            logger.debug("Storage calculation details", {
                "data_dir": data_dir,
                "data_files_count": len(data_files),
                "data_size_mb": round(data_size_bytes / (1024 * 1024), 2),
                "logs_dir": logs_dir,
                "log_files_count": len(log_files),
                "logs_size_mb": round(logs_size_bytes / (1024 * 1024), 2)
            })
            
            health_status["components"]["storage"] = {
                "status": "ok",
                "data_size_in_gb": data_size_in_gb,
                "logs_size_in_gb": logs_size_in_gb,
                "data_files_count": len(data_files),
                "log_files_count": len(log_files)
            }
        except Exception as e:
            logger.error("Storage calculation failed", {"error": str(e)})
            health_status["components"]["storage"] = {
                "status": "error",
                "error": str(e)
            }
        logger.flush()  # Ensure storage calculation logs are written

        # If any component is unhealthy, change status and return 503
        if (not health_status["components"]["database"]["connected"] or 
            health_status["components"]["cache"]["status"] == "error"):
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

        if not analytics_cache["data"]:
            return {"error": "Cache not initialized"}, 503

        # Calculate cache age and status using UTC timestamps
        cache_age = (datetime.now(utc) - analytics_cache["last_updated"]).total_seconds()
        cache_status = "fresh" if cache_age <= 60 else "stale" if cache_age > 180 else "ok"
        
        response = {
            "data": analytics_cache["data"],  # The actual analytics data
            "cache": {
                "last_updated": analytics_cache["last_updated"].isoformat(),
                "age_seconds": int(cache_age),
                "status": cache_status,
                "next_update_in": max(0, 30 - (cache_age % 30))  # Time until next update
            },
            "duration": r(time.time() - start_time)
        }
        
        return response

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
            logger.error("calc_room_stats failed", {"error": e})
            logger.flush()
            abort(500)

        duration = r(time.time() - start_time)
        logger.debug("calc_room_stats completed", {"duration": duration})  # Changed to DEBUG
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

        duration = r(time.time() - start_time)
        logger.debug("landingpage-analytics completed", {"duration": duration, "landingpage_analytics": landingpage_analytics})  # Changed to DEBUG
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
