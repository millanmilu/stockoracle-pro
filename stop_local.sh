#!/bin/bash
echo "Stopping local StockOracle Pro services..."
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
echo "Services stopped."
