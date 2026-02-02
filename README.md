🚀 Q-Flow: Virtual Queue & Token Management System
![alt text](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js&logoColor=white)

![alt text](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=black)

![alt text](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)

![alt text](https://img.shields.io/badge/License-MIT-yellow.svg)
Q-Flow is a modern, lightweight queue management solution designed to eliminate physical waiting lines. It bridges the gap between service providers (offices) and visitors through real-time token tracking, capacity optimization, and automated ETA forecasting.
✨ Key Features
🏢 For Offices (Admin)
Capacity Control: Set daily limits and toggle real-time availability.
Dynamic Queue Management: "Call Next" functionality with automatic seat allocation.
Performance Tracking: Set average service times to provide accurate ETAs to customers.
Status Control: Mark tokens as Completed, Cancelled, or No-Show to instantly update office capacity.
👤 For Customers
Instant Booking: Join a queue or book a slot with minimal data entry.
Live Tracking: Monitor queue position and estimated wait time in real-time.
Zero Friction: No account required—access status via unique token IDs.
🛠 Tech Stack
Layer	Technology
Frontend	React 18 (Vite), Tailwind CSS
Backend	Node.js, Express.js
Database	SQLite via better-sqlite3
Authentication	Header-based Admin Key Verification
State Management	React Hooks & Context API
🚀 Quick Start
Prerequisites
Node.js (v16.x or higher)
npm or yarn
1. Backend Configuration
code
Bash
cd backend
npm install

# Create environment configuration
echo "PORT=4000
ADMIN_KEY=your-secure-admin-key
CLIENT_ORIGIN=http://localhost:5173" > .env

npm run dev
2. Frontend Configuration
code
Bash
cd frontend
npm install

# Launch the development server
npm run dev -- --host
Navigate to http://localhost:5173. Ensure you enter the ADMIN_KEY in the application settings to unlock administrative privileges.
📑 API Reference
Office Management
Method	Endpoint	Description	Auth
GET	/api/offices	List all offices & live counts	Public
POST	/api/offices	Create a new service location	Admin
PATCH	/api/offices/:id/settings	Update capacity/hours	Admin
POST	/api/offices/:id/call-next	Pull the next visitor from queue	Admin
Token & Booking
Method	Endpoint	Description	Auth
POST	/api/offices/:id/book	Book a token or join queue	Public
GET	/api/tokens/:id	Get token status & ETA	Public
POST	/api/tokens/:id/cancel	Cancel a booking	Public
POST	/api/tokens/:id/complete	Mark service as finished	Admin
🧠 System Logic
Capacity & Flow
Seat Allocation: Available seats decrement automatically when a visitor is "Called" or "Booked."
Wait Time Calculation:
ETA = (Queue Position) × (Average Service Minutes)
Auto-Sync: The system uses a polling/refresh mechanism to ensure that as soon as a token is completed, the seat becomes available for the next visitor in the virtual queue.
📁 Project Structure
code
Text
queue-management/
├── backend/
│   ├── data/           # SQLite database storage
│   ├── routes/         # Express API endpoints
│   └── server.js       # Main application entry
├── frontend/
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── hooks/      # Custom React hooks
│   │   └── pages/      # View logic (Admin/Customer)
│   └── vite.config.js
└── README.md
🛡 License
Distributed under the MIT License. See LICENSE for more information.
Developed by [Your Name/Github]
Project Link: https://github.com/yourusername/q-flow
