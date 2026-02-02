# 🚀 GetEzi | Smart Queue Management System

> **Transform physical waiting lines into a seamless digital experience.** 

GetEzi is a lightweight, high-performance virtual token system. It allows businesses to manage visitor flow in real-time while giving customers the freedom to track their wait status from their own devices.

---

### 🛠 Tech Stack & Status
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

---

### ✨ Key Features

#### 🏢 For Administrators
- **Live Dashboard:** Monitor current capacity and total bookings.
- **Smart Calling:** One-click "Call Next" logic to move the queue forward.
- **Dynamic Controls:** Open/Close bookings instantly based on office capacity.
- **Status Lifecycle:** Mark visitors as *Completed*, *Cancelled*, or *No-Show*.

#### 👤 For Customers
- **Zero-Login Booking:** Get a token instantly without creating an account.
- **Live Tracker:** Real-time position updates and estimated wait times (ETA).
- **ETA Prediction:** Calculated automatically based on average service duration.

---

### 🚀 Quick Start Guide

#### 1. Backend Setup
```bash
cd backend
npm install
Create a .env file in the backend folder:
code
Env
PORT=4000
ADMIN_KEY=your-secret-key
CLIENT_ORIGIN=http://localhost:5173
Run the server:
code
Bash
npm run dev
2. Frontend Setup
code
Bash
cd frontend
npm install
npm run dev -- --host
Open http://localhost:5173 and enter your ADMIN_KEY in the UI to access the Admin Panel.
📡 API Documentation
Method	Endpoint	Description	Auth
GET	/api/offices	List all offices & live counts	Public
POST	/api/offices	Create a new office location	Admin
POST	/api/offices/:id/book	Join the queue / Get token	Public
POST	/api/offices/:id/call-next	Call the next person in line	Admin
GET	/api/tokens/:id	Get real-time status & ETA	Public
🧠 System Intelligence
Seat Recycling: When a token is marked as Completed or No-Show, the system automatically frees up a seat and updates the office capacity in real-time.
Queue Logic:
Available Today: Decrements on booking.
Queue Position: Calculated based on active tokens created before yours.
ETA Calculation: (Position in Queue) × (Office Avg Service Time).
📁 Folder Structure
code
Text
GetEzi/
├── 📂 backend/
│   ├── 📂 data/        # SQLite Database
│   ├── 📂 routes/      # Express API Controllers
│   └── server.js      # Main Entry Point
└── 📂 frontend/
    ├── 📂 src/
    │   ├── 📂 components/ # UI Elements
    │   └── 📂 pages/      # Customer & Admin Views
    └── vite.config.js
🛡 License
This project is licensed under the MIT License - see the LICENSE file for details.
