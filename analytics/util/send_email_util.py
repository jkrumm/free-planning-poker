import requests

from config import BEA_BASE_URL, BEA_SECRET_KEY


def send_email_util(endpoint, body):
    request = requests.post(
        url="http://" + BEA_BASE_URL + ":3010/" + endpoint, #NOSONAR
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + BEA_SECRET_KEY
        },
        json=body
    )

    if request.status_code != 200:
        raise Exception("Failed to send email with status " + str(request.status_code))

