#!/bin/bash
# start.sh — Launch backend + frontend together

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Smart Supply Chain Intelligence System          ║"
echo "║  Road · Rail · Sea — India Multi-Modal Monitor   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Kill any existing processes on ports 8000 and 3000
echo "→ Cleaning up existing processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start Backend
echo "→ Starting FastAPI backend on port 8000..."
cd backend
pip install -r requirements.txt -q
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"
cd ..

# Wait for backend
sleep 2

# Start Frontend
echo "→ Starting React frontend on port 3000..."
cd frontend
npm install --silent
npm start &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"
cd ..

echo ""
echo "═══════════════════════════════════════════"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "  Frontend: http://localhost:3000"
echo "═══════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Wait and handle shutdown
trap "echo '→ Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT
wait
