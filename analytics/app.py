import os
import time
from dotenv import load_dotenv

from flask import Flask, request, abort

from scripts.update_read_model import update_read_model
from util.log_util import logger

app = Flask(__name__)

load_dotenv()
ANALYTICS_SECRET_TOKEN = os.getenv("ANALYTICS_SECRET_TOKEN")


@app.route("/")
def hello_world():
    token = request.headers.get('Authorization')

    if token != ANALYTICS_SECRET_TOKEN or ANALYTICS_SECRET_TOKEN is None:
        abort(401)

    start_time = time.time()

    try:
        update_read_model()
    except Exception as e:
        logger.error(f"Script update_read_model failed", {"error": e})

    logger.flush()

    return {
        "message": 'Script executed successfully!',
        "time_taken": f"{time.time() - start_time:.2f}s"
    }
