FROM python:3.12-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir fastapi uvicorn pydantic

# Copy application
COPY app.py .

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 8090

# Run application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]
