import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="StockOracle Pro API",
    description="Production-grade AI stock forecasting API using PyTorch and FastAPI",
    version="1.0.0"
)

# CORS configuration
origins = [
    "http://localhost:5173",  # React local dev
    "https://main.d2xxxx.amplifyapp.com",  # Replace with Amplify domain
    "*",  # Allow all temporarily for easy testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to StockOracle Pro Advanced AI Market Forecasting API Engine.",
        "version": "1.0.0",
        "environment": os.getenv("ENV", "production")
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
