from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

from app import app as application
