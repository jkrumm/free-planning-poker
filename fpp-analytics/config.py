import os

from dotenv import load_dotenv

load_dotenv()

# Data storage
DATA_DIR = os.getenv("DATA_DIR", "./data")

# Database (direct connection, same docker network)
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "mariadb"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USERNAME", "fpp"),
    "password": os.getenv("DB_PASSWORD"),
    "database": "free-planning-poker",
    "charset": "utf8mb4",
    "use_pure": True,
}

# Authentication
ANALYTICS_SECRET_TOKEN = os.getenv("ANALYTICS_SECRET_TOKEN")

# Email service
EMAIL_GATEWAY_URL = os.getenv("EMAIL_GATEWAY_URL")
EMAIL_GATEWAY_SECRET_KEY = os.getenv("EMAIL_GATEWAY_SECRET_KEY")

# Monitoring
UPTIMEKUMA_PUSH_URL = os.getenv("UPTIMEKUMA_PUSH_URL")

# Analytics constants
START_DATE = "2024-06-03"
