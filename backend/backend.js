const express = require('express');
const session = require('express-session');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cors({
    origin: 'http://localhost:3000', 
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(session({
    secret: 'yoursecretkey',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 dia
}));



// Importação das rotas organizadas
const auth_API = require('./passadIA_API/user_auth_API');
const user_API = require('./passadIA_API/user_API');
const history_API = require('./passadIA_API/history_API');
const favorites_API = require('./passadIA_API/favorites_API');
const walkway_API = require('./passadIA_API/walkway_API');
const recommender_API = require('./passadIA_API/recommender_API');
const gamification_API = require('./passadIA_API/gamification_API');

// Uso das rotas
app.use(auth_API);
app.use(user_API);
app.use(history_API);
app.use(favorites_API);
app.use(walkway_API);
app.use(recommender_API);
app.use(gamification_API);

// Endpoint raiz para teste
app.get('/', (req, res) => {
  res.send('PassadIA backend is running 🚀');
});

app.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});
