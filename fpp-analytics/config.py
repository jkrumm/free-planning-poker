import os
from dotenv import load_dotenv

load_dotenv()

# Data storage
DATA_DIR = os.getenv('DATA_DIR', './data')

# Database (direct connection, same docker network)
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'mariadb'),
    'port': int(os.getenv('DB_PORT', '3306')),
    'user': os.getenv('DB_USERNAME', 'fpp'),
    'password': os.getenv('DB_PASSWORD'),
    'database': 'free-planning-poker',
    'charset': 'utf8mb4',
    'use_pure': True,
}

# Authentication
ANALYTICS_SECRET_TOKEN = os.getenv('ANALYTICS_SECRET_TOKEN')

# Email service
BEA_BASE_URL = os.getenv('BEA_BASE_URL')
BEA_SECRET_KEY = os.getenv('BEA_SECRET_KEY')

# Monitoring
SENTRY_DSN = os.getenv('FPP_ANALYTICS_SENTRY_DSN')
SENTRY_ENVIRONMENT = os.getenv('SENTRY_ENVIRONMENT', 'production')
UPTIMEKUMA_PUSH_URL = os.getenv('UPTIMEKUMA_PUSH_URL')

# Analytics constants
START_DATE = "2024-06-03"
