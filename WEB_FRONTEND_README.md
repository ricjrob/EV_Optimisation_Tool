# 🌐 Web Frontend Setup Guide

This folder contains the FastAPI web application and frontend interface for testing the EV Charging Bay Calculator.

## 📁 Files Created

- **`app.py`** - FastAPI backend server with REST API endpoints
- **`static/index.html`** - Web interface (HTML)
- **`static/style.css`** - Styling for the web interface
- **`static/script.js`** - Frontend logic and API communication

## 🚀 Quick Start

### 1. Make sure dependencies are installed
```bash
pip install -r requirements.txt
```

### 2. Run the web server
```bash
python app.py
```

Or alternatively:
```bash
uvicorn app:app --reload
```

### 3. Open in browser
Navigate to: **http://localhost:8000**

## 📝 Features

The web interface provides:

- **Interactive Configuration Panel**
  - Total daily sessions input
  - Hourly distribution presets (even, peak morning/afternoon, night-friendly)
  - Manual hourly distribution editing with validation
  - Average service time settings
  - Utilisation target and safety buffer parameters

- **Results Dashboard**
  - Maximum bays needed (summary)
  - Hourly breakdown table with detailed metrics
  - Visual bar chart showing bays required per hour

- **Preset Distributions**
  - **Even**: Uniform distribution across all hours
  - **Peak Morning/Evening**: Higher demand morning and evening
  - **Peak Afternoon**: Higher demand during afternoon hours
  - **Night-Friendly**: Encourages off-peak charging
  - **Custom**: Manual entry of 24 hourly values

## 🔌 API Endpoints

### `POST /api/calculate`
Calculate required bays based on configuration.

**Request:**
```json
{
  "profile": {
    "total_sessions": 100,
    "hourly_dist": [0.042, 0.042, ..., 0.042]  // 24 values
  },
  "calculator": {
    "avg_service_time": 35.0,
    "util_target": 0.8,
    "safety_buffer": 0.15
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "hour": 0,
      "sessions": 4,
      "total_time": 2.33,
      "throughput": 1.71,
      "bays_needed": 2
    },
    ...
  ],
  "max_bays_needed": 5
}
```

### `GET /api/example`
Get example configuration for testing.

## 🧪 Testing Tips

1. **Load Example**: Click "Load Example" to populate with default test data
2. **Normalize**: If your distribution doesn't sum to 1.0, click "Normalize" to auto-fix
3. **Presets**: Try different hourly distribution presets to see how demand patterns affect bay requirements
4. **Parameters**: Experiment with:
   - Different utilisation targets (0.7 = relaxed, 0.9 = tight)
   - Safety buffer (higher = more conservative estimate)
   - Service times (longer = more bays needed)

## 📊 Understanding Results

- **Sessions**: Number of charging sessions in that hour
- **Total Time**: Total hours of charging needed (sessions × avg_service_time ÷ 60)
- **Throughput**: How many sessions one bay can handle in that hour
- **Bays Needed**: Minimum bays to handle demand at target utilisation

## 🛑 Troubleshooting

**Port 8000 already in use?**
```bash
uvicorn app:app --port 8001
```

**Module import errors?**
Make sure you're running from the project root directory:
```bash
cd /Users/richardroberts/Documents/Projects/EV_Optimisation_Tool
python app.py
```

**Distribution validation error?**
- All 24 values must be between 0 and 1
- Values should sum to approximately 1.0 (use "Normalize" button)

## 📚 Next Steps

- Enhance visualizations with charts (see ChartJS integration possibility)
- Add scenario comparison features
- Export results to CSV
- Add historical data visualization
- Implement sensitivity analysis
