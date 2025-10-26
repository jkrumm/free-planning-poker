FROM python:3.11.1

# Set the working directory in the container
WORKDIR /usr/src/app

# Install git and other package dependencies
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git

# Copy the contents from the local directory into the container
COPY . .

# Change the working directory to the copied application directory
WORKDIR /usr/src/app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Make port 5100 available to the world outside this container
EXPOSE 5100

# Run app.py when the container launches
# Using 2 workers with 2 threads each for low-traffic analytics app with background scheduler
# --max-requests restarts workers after 1000 requests to prevent memory leaks
CMD ["gunicorn", "-b", "0.0.0.0:5100", "--workers", "2", "--threads", "2", "--worker-class", "gthread", "--timeout", "120", "--max-requests", "1000", "--max-requests-jitter", "50", "app:app"]