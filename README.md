🚀 GetEzi: Intelligent Queue Management
GetEzi is a high-performance, virtual queue and token system designed to modernize how offices manage visitor flow. By replacing physical lines with a digital-first approach, it provides real-time transparency for customers and powerful administrative tools for service providers.
![alt text](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js&logoColor=white)

![alt text](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=black)

![alt text](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)

![alt text](https://img.shields.io/badge/License-MIT-yellow.svg)
🌟 Key Features
🏢 For Administrators
Real-time Capacity Management: Toggle office availability and set daily booking limits instantly.
"Call Next" Logic: Intelligently transition visitors from "Queued" to "Called" with one click.
Workflow Control: Manage the lifecycle of a token through Complete, No-Show, or Cancel states.
Settings Dashboard: Configure average service times to automate customer ETA calculations.
👤 For Customers
Frictionless Booking: Join a queue or book a specific slot without needing to create an account.
Live Status Tracking: A dedicated tracking page showing current position and estimated wait time.
Instant Notifications: Immediate feedback on token status changes.
🛠 Tech Stack
Component	Technology
Frontend	React 18 (Vite), Tailwind CSS
Backend	Node.js, Express.js
Database	SQLite (via better-sqlite3)
Authentication	Header-based Admin Key Verification (x-admin-key)
🚀 Quick Start
1. Backend Setup
code
Bash
cd backend
# Create environment file
echo "PORT=4000
ADMIN_KEY=your-secret-key
CLIENT_ORIGIN=http://localhost:5173" > .env

npm install
npm run dev
2. Frontend Setup
code
Bash
cd frontend
npm install
npm run dev -- --host
Visit http://localhost:5173. Set your ADMIN_KEY in the UI settings to access management features.
📑 API Documentation
Office Endpoints
Method	Endpoint	Description
GET	/api/offices	Fetch all offices with live queue counts
POST	/api/offices	Create a new office (Admin required)
PATCH	/api/offices/:id/settings	Update capacity & operating hours
POST	/api/offices/:id/call-next	Move the next person into service
Token Endpoints
Method	Endpoint	Description
POST	/api/offices/:id/book	Customer booking/joining queue
GET	/api/tokens/:id	Get detailed token status and ETA
POST	/api/tokens/:id/complete	Mark visitor as served (Admin)
POST	/api/tokens/:id/no-show	Mark visitor as missed (Admin)
🧠 System Logic: How it Works
Capacity Check: When a customer books, the system checks if availableToday > 0.
Status Flow: Tokens move through a state machine: Pending ➔ Called ➔ Completed/No-Show.
ETA Calculation:
Wait Time = (Queue Position) × (Office AvgServiceMinutes)
Seat Recycling: As soon as a token is marked Completed, Cancelled, or No-Show, a seat is automatically freed up in the office capacity.
📁 Project Structure
code
Text
GetEzi/
├── backend/
│   ├── data/           # SQLite .db files
│   ├── routes/         # Express API controllers
│   └── server.js       # Entry point
└── frontend/
    ├── src/
    │   ├── components/ # Atomic UI elements
    │   ├── hooks/      # Custom React hooks (useQueue, useAuth)
    │   └── pages/      # View logic
🛡 License
This project is licensed under the MIT License - see the LICENSE file for details.
Developed by Sandesh Parit
