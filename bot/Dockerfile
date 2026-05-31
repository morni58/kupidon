FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Install bot dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared backend models/services
COPY ../backend/requirements.txt /tmp/backend_req.txt
RUN pip install --no-cache-dir -r /tmp/backend_req.txt

# Copy backend app (shared models)
COPY ../backend /app/backend

# Copy bot code
COPY . .

ENV PYTHONPATH=/app/backend

CMD ["python", "bot.py"]
