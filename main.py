import os
from datetime import datetime, timedelta # Import timedelta
from typing import List, Optional

import uvicorn
import yfinance as yf
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # Import CORS middleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base

# Load environment variables from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# SQLAlchemy setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Model for Stock Data
class StockData(Base):
    __tablename__ = "stock_data"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    timestamp = Column(DateTime, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Integer)

# Create database tables (if they don't exist)
# In a real application, you might use Alembic for migrations
Base.metadata.create_all(bind=engine)

# FastAPI app instance
app = FastAPI()

# CORS Middleware Configuration
origins = [
    "http://localhost", # Allow local development (adjust port if needed)
    "http://localhost:8080", # Common port for local dev servers
    "http://127.0.0.1",
    "http://127.0.0.1:8080",
    "null", # Allow requests from file:// origins (like opening index.html directly)
    # Add the origin of your deployed frontend if applicable
    # "https://your-frontend-domain.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # List of origins allowed
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods (GET, POST, etc.)
    allow_headers=["*"], # Allow all headers
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Data Fetching and Storing Logic ---
def fetch_and_store_stock_data(symbol: str, db: Session):
    """Fetches historical data for a symbol and stores it in the DB."""
    ticker = yf.Ticker(symbol)
    # Fetch historical data (e.g., last 5 days)
    # Adjust period/interval as needed
    hist = ticker.history(period="5d") # You can adjust the period

    if hist.empty:
        print(f"No data found for symbol {symbol}")
        return # Or raise an exception

    # Iterate through the fetched data (index is the date)
    for timestamp, row in hist.iterrows():
        # Check if data for this symbol and timestamp already exists
        exists = db.query(StockData).filter(
            StockData.symbol == symbol,
            StockData.timestamp == timestamp.to_pydatetime() # Convert pandas Timestamp
        ).first()

        if not exists:
            stock_record = StockData(
                symbol=symbol,
                timestamp=timestamp.to_pydatetime(), # Convert pandas Timestamp
                open=float(row['Open']),      # Cast to float
                high=float(row['High']),      # Cast to float
                low=float(row['Low']),        # Cast to float
                close=float(row['Close']),    # Cast to float
                volume=int(row['Volume']) # Ensure volume is integer
            )
            db.add(stock_record)

    db.commit()
    print(f"Data fetched and stored/updated for {symbol}")
    pass

# --- API Endpoints ---

@app.post("/stocks/{symbol}", status_code=201)
async def update_stock_data(symbol: str, db: Session = Depends(get_db)):
    """
    Fetches the latest stock data for the given symbol and stores it.
    """
    try:
        # Placeholder call - replace with actual implementation
        fetch_and_store_stock_data(symbol, db)
        return {"message": f"Successfully updated data for {symbol}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Pydantic model for response (optional but good practice)
from pydantic import BaseModel

class StockDataResponse(BaseModel):
    id: int
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

    class Config:
        orm_mode = True # Allows Pydantic to work with ORM objects

@app.get("/stocks/{symbol}", response_model=List[StockDataResponse])
async def get_stock_data(symbol: str, start_date: Optional[str] = None, end_date: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Retrieves stored stock data for the given symbol, optionally filtered by date (YYYY-MM-DD).
    """
    query = db.query(StockData).filter(StockData.symbol.ilike(symbol)) # Case-insensitive symbol match

    try:
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(StockData.timestamp >= start_dt)
        if end_date:
            # Add 1 day to end_date to make it inclusive
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(StockData.timestamp < end_dt) # Use < for end date
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Please use YYYY-MM-DD.")

    data = query.order_by(StockData.timestamp.desc()).all()

    if not data:
         raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol} within the specified date range.")

    return data


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)