# ⚡ EV Charging Demand Model (MVP)

A lightweight prototype for estimating **how many EV charging bays are required** at a given site based on expected visits and average dwell time. This is the first step toward a full demand‑prediction platform for EV charging infrastructure across the UK.

---

## 🎯 Purpose

This MVP answers one simple question:

> **Given the number of expected EV visits per day and the average charging duration, how many bays are required to avoid congestion and over investment?**

The goal is to provide a transparent, easy‑to‑extend baseline that future versions can build on as richer datasets (sessions, occupancy, weather, land use, mobility, charging hardware types, charging speeds and battery efficiency etc.) are added.

---

## 🧠 How It Works

The model uses a basic utilisation formula:

- **Visits per day**
- **Average dwell time (minutes)**
- **Operating hours per day** (default: 24)
- **Expected spread of charging sessions throughout the day
- **Seasonal trend 

From this, it estimates:

- **Total charging hours required per day**
- **Maximum throughput per bay**
- **Minimum number of bays needed**

This gives a first‑pass sizing estimate for planners, analysts, and early‑stage site assessments.

---
```
## 📦 Project Structure
/README.md          # You're reading it
/pyproject.toml     # or requirements.txt + setup.cfg
/data               # Example input data (optional)
/notebooks          # Exploratory calculations and validation
/src
    __init.py__     
    /data           # Curated data sets
    model.py        # Core bay calculation logic
    utils.py        # Helpers for time, config, etc.
/app.py             # API entry point for serving predictions
/main.py            # CLI entry point for running the model
```


---

## 🚀 Getting Started

### 1. Install dependencies

pip install -r requirements.txt


### 2. Run a simple example

```python
from src.model import estimate_bays

bays = estimate_bays(
    visits_per_day=120,
    avg_dwell_minutes=35,
    operating_hours=24,
)

print(bays)
```

## 📘 Example Output
```python
Estimated bays required: 4
```

## 🛣️ Roadmap
This MVP is the foundation for a much richer EV demand prediction system. Planned enhancements include:

• Integration of open session data (TfL, NCR, council FOIs)
• Temporal demand modelling (hourly patterns)
• Weather, land‑use, and mobility features
• Machine learning forecasting models (GBM, TFT)
• Live occupancy validation
• Site‑level embeddings for generalisation

---

## 🤝 Contributing
This is an early‑stage prototype. Contributions, ideas, and data sources are welcome.

---

## 📄 License
No license to retain IP on this personal project 


