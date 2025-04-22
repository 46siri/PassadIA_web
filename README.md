# Getting Started with PassadIA

PassadIA é uma aplicação web para explorar percursos pedestres, acompanhar o histórico de caminhadas e gerir perfis personalizados. A aplicação inclui **frontend em React** e **backend com Node.js/Firebase**.

---

## 📁 Project Structure

```
PassadIA/
├── frontend/           # React App
├── backend/            # Node.js server (Express + Firebase Admin)
├── README.md
└── ...
```

---

## 🚀 Running the Project

O projeto é dividido em duas partes: **Frontend (React)** e **Backend (Node.js)**.

---

## ▶️ Frontend - React

### 📂 Caminho: `./frontend`

### 📦 Instalar dependências

```bash
cd frontend
npm install
```

### 🧪 Comandos disponíveis

#### `npm start`
Inicia a aplicação em modo de desenvolvimento.Abre [http://localhost:3000](http://localhost:3000) no navegador.

#### `npm test`
Executa os testes interativos.

#### `npm run build`
Cria a versão de produção da aplicação no diretório `build`.

#### `npm run eject`
Ejecta a configuração padrão do Create React App.

---

## 🖥️ Backend - Node.js + Express + Firebase Admin

### 📂 Caminho: `./backend`

### 📦 Instalar dependências

```bash
cd backend
npm install
```

### 🔐 Requisitos

- Criar um ficheiro `serviceAccountKey.json` com as credenciais da conta de serviço do Firebase.
- Colocar esse ficheiro dentro da pasta `backend/` (e adicionar ao `.gitignore`!).

### ▶️ Iniciar o servidor

```bash
npm run dev
```

> Por padrão, o servidor corre em [http://localhost:8080](http://localhost:8080)

---

## 🔐 Autenticação

A autenticação de utilizadores é feita com Firebase Auth.Para operações seguras (como eliminar contas), é usada a [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup).

---

## 📦 Dependências principais

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
