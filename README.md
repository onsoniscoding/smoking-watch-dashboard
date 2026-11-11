
# Smoke Watch

A smoking detection monitoring dashboard that receives AI detection events,
stores event records, and provides monitoring statistics.

## Project Features

- Dashboard Overview
- Detection Logs
- Detection Statistics
- Backend REST API
- Detection Event Storage
- System Heartbeat
- LINE Test Notification
- AI and Edge Integration API

## Technologies

### Frontend
- React
- Vite
- Tailwind CSS
- Axios
- React Router
- Recharts
- Lucide React

### Backend
- Node.js
- Express
- Lowdb
- JSON Database
- LINE Messaging API

## Project Structure

    smoke-watch-dashboard/
    ├── frontend/
    ├── backend/
    ├── docs/
    ├── .gitignore
    └── README.md

## Installation

### Frontend

    cd frontend
    npm install
    npm run dev

### Backend

    cd backend
    npm install
    npm run dev

## Environment Variables

Create backend/.env based on backend/.env.example.

Create frontend/.env with:

    VITE_API_URL=http://localhost:3000/api

Never commit actual secret values.

## API

See docs/API_DOCUMENTATION.md.

## Testing

See docs/TESTING.md.

## Project Roles

- AI & CiRA CORE Engineer
- IoT, Hardware & Edge Engineer
- Frontend, Integration & Project Manager
