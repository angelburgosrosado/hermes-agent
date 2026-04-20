FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy full warroom package
COPY . ./warroom/

ENV WARROOM_PORT=8080
ENV WARROOM_MODE=production

EXPOSE 8080

CMD ["python", "-m", "warroom.server"]
