import os

ANALYTICS_SECRET_TOKEN = os.getenv("ANALYTICS_SECRET_TOKEN")
DATA_DIR = os.getenv('DATA_DIR', './data')
BEA_BASE_URL = os.getenv('BEA_BASE_URL')
BEA_SECRET_KEY = os.getenv('BEA_SECRET_KEY')
