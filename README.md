# ConnectSphere — Mini Social Media Platform

A full-featured social media app built with **HTML · CSS · Vanilla JS · Express.js · MySQL**.

## Tech Stack
| Layer    | Technology |
|----------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| Backend  | Express.js (Node.js) |
| Database | MySQL (mysql2) |
| Auth     | bcryptjs + jsonwebtoken |
| Uploads  | multer (local /uploads folder) |

## Features
- ✅ Register & Login (email or username)
- ✅ User Profiles with follow/unfollow
- ✅ Home Feed (latest posts)
- ✅ Create Posts with optional image upload
- ✅ Stories (24-hour ephemeral posts)
- ✅ Like / Unlike posts
- ✅ Comment & Delete own comments
- ✅ Save / Unsave posts
- ✅ Repost
- ✅ Explore page (discover users + posts)
- ✅ Hashtags — clickable, dedicated feed per tag
- ✅ Trending hashtags sidebar
- ✅ Search users by name or username
- ✅ Direct Messages (polling-based)
- ✅ Notifications (likes, comments, follows, reposts)
- ✅ Edit Profile (bio, name, avatar)
- ✅ Activity status (last_active)

## Setup & Run

### 1. Configure environment
Edit `backend/.env` — set your MySQL credentials:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=connectsphere
JWT_SECRET=change_this_in_production
PORT=5000
```

### 2. Initialize the database
```bash
cd backend
node server/config/init.js
```

### 3. Start the backend
```bash
cd backend
npm run dev        # with nodemon (auto-restart)
# or
npm start          # production
```
Backend runs at **http://localhost:5000**

### 4. Start the frontend
```bash
cd frontend
npm start
```
Frontend runs at **http://localhost:3000**

Open **http://localhost:3000** in your browser.

## Project Structure
```
Social Media/
├── backend/
│   ├── server/
│   │   ├── config/
│   │   │   ├── db.js          # MySQL pool
│   │   │   └── init.js        # DB + table creation
│   │   ├── controllers/       # Business logic
│   │   ├── middleware/        # Auth + upload
│   │   ├── routes/            # Express routes
│   │   └── server.js          # Entry point
│   ├── uploads/               # Uploaded images
│   └── .env
└── frontend/
    ├── css/style.css          # Complete design system
    ├── js/
    │   ├── api.js             # API client
    │   └── app.js             # SPA router + all pages
    ├── index.html             # Single HTML shell
    └── server.js              # Static file server
```
