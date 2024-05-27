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
CMD ["gunicorn", "-b", "0.0.0.0:5100", "app:app"]