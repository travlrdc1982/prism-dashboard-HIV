FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements_simulation.txt .
RUN pip install --no-cache-dir -r requirements_simulation.txt

# Copy the API and models
COPY prism_simulation_api.py .
COPY PersuasionModels/ ./PersuasionModels/
COPY dashboard.json .

# Expose port
EXPOSE 8000

# Start the API
CMD ["uvicorn", "prism_simulation_api:app", "--host", "0.0.0.0", "--port", "8000"]
