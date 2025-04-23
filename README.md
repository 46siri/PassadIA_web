# Getting Started with PassadIA

PassadIA is a web application to explore walkways, track walking history, and manage personalized user profiles. The app includes a React frontend and a Node.js/Firebase backend.
---

## 📁 Project Structure

```
PassadIA/
├── frontend/           # React App
├── backend/            # Node.js server (Express + Firebase Admin)
└── README.md
```

---

## 🚀 Running the Project

The project is divided into two parts: **Frontend (React)** and **Backend (Node.js)**.

---

## ▶️ Frontend - React

### 📂 Path: `./frontend`

### 📦 Install dependencies

```bash
cd frontend
npm install
```

### 🧪 Available commands

#### `npm start`
Starts the app in development mode.
Opens [http://localhost:3000](http://localhost:3000) in your browser.

#### `npm test`
Runs interactive test runner.

#### `npm run build`
Builds the app for production to the `build` folder.

#### `npm run eject`
Ejects the default Create React App configuration.
---

## 🖥️ Backend - Node.js + Express + Firebase Admin

### 📂 Path: `./backend`

### 📦 Install dependencies

```bash
cd backend
npm install
```

### 🔐 Requirements

- Create a `serviceAccountKey.json` file with your Firebase service account credentials.
- Place this file inside the `backend/` folder (and make sure it's listed in `.gitignore`!).

### ▶️ Starting the server

```bash
npm run dev
```

> By default, the server runs on [http://localhost:8080](http://localhost:8080)

---

## 🔐 Athentication

User authentication is handled by Firebase Auth.
For secure operations (such as deleting accounts), the [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) is used..

---

## 📦 Main dependencies

### Frontend
- React
- MUI (Material UI)
- Axios
- React Router

### Backend
- Express
- Firebase Admin SDK
- Firebase SDK
- Cookie-Session
- Multer

---

## 📚 Learn More

- [Create React App Docs](https://facebook.github.io/create-react-app/docs/getting-started)
- [Firebase Docs](https://firebase.google.com/docs)
- [Material UI](https://mui.com/)
