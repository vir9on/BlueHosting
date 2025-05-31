require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const NodeCache = require('node-cache');
const {
  mainLimiter,
  speedLimiter,
  authLimiter,
  depositLimiter,
  helmetConfig,
  ipCheck,
  suspiciousActivityMonitor,
  blockIP
} = require('./security');
const { Pterodactyl } = require('pterodactyl.js');

const app = express();

// Кэш для хранения временных данных
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// Security middleware
app.use(helmetConfig);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Применяем защиту от DDoS
app.use(ipCheck);
app.use(suspiciousActivityMonitor);
app.use(mainLimiter);
app.use(speedLimiter);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Initialize Pterodactyl client
const pterodactyl = new Pterodactyl({
  url: process.env.PTERODACTYL_URL,
  apiKey: process.env.PTERODACTYL_API_KEY,
  clientApiKey: process.env.PTERODACTYL_CLIENT_API_KEY
});

// Models
const UserSchema = new mongoose.Schema({
  login: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  pterodactylId: { type: String }, // ID пользователя в Pterodactyl
  servers: [{
    name: String,
    tariff: String,
    price: Number,
    date: { type: Date, default: Date.now },
    pterodactylServerId: String // ID сервера в Pterodactyl
  }],
  lastLogin: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  ipAddresses: [{ type: String }] // Храним историю IP-адресов
});

const User = mongoose.model('User', UserSchema);

// Middleware для проверки токена
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    // Проверяем IP-адрес
    const ip = req.ip || req.connection.remoteAddress;
    if (!user.ipAddresses.includes(ip)) {
      user.ipAddresses.push(ip);
      await user.save();
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes
// Регистрация
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { login, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    
    // Проверка сложности пароля
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Проверка существования пользователя
    const existingUser = await User.findOne({ login });
    if (existingUser) {
      return res.status(400).json({ error: 'Login already taken' });
    }
    
    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создание пользователя в Pterodactyl
    const pterodactylUser = await pterodactyl.createUser({
      username: login,
      email: `${login}@example.com`, // Можно добавить поле email в форму регистрации
      password: password,
      first_name: login,
      last_name: 'User'
    });
    
    // Создание пользователя в нашей базе
    const user = new User({
      login,
      password: hashedPassword,
      balance: 0,
      pterodactylId: pterodactylUser.id,
      servers: [],
      ipAddresses: [ip]
    });
    
    await user.save();
    
    // Создание токена
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      success: true,
      token,
      user: {
        login: user.login,
        balance: user.balance,
        servers: user.servers
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Авторизация
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { login, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    
    // Поиск пользователя
    const user = await User.findOne({ login });
    if (!user) {
      return res.status(400).json({ error: 'Invalid login or password' });
    }
    
    // Проверка блокировки
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const timeLeft = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return res.status(403).json({ error: `Account locked. Try again in ${timeLeft} minutes` });
    }
    
    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      user.failedLoginAttempts += 1;
      
      // Блокировка после 5 неудачных попыток
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 минут
        await user.save();
        return res.status(403).json({ error: 'Too many failed attempts. Account locked for 15 minutes' });
      }
      
      await user.save();
      return res.status(400).json({ error: 'Invalid login or password' });
    }
    
    // Сброс счетчика неудачных попыток
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    if (!user.ipAddresses.includes(ip)) {
      user.ipAddresses.push(ip);
    }
    await user.save();
    
    // Создание токена
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      success: true,
      token,
      user: {
        login: user.login,
        balance: user.balance,
        servers: user.servers
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение профиля
app.get('/api/profile', auth, async (req, res) => {
  try {
    res.json({
      login: req.user.login,
      balance: req.user.balance,
      servers: req.user.servers
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Пополнение баланса
app.post('/api/deposit', auth, depositLimiter, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // Проверка на максимальную сумму
    if (amount > 10000) {
      return res.status(400).json({ error: 'Maximum deposit amount is 10000' });
    }
    
    req.user.balance += amount;
    await req.user.save();
    
    res.json({
      success: true,
      balance: req.user.balance
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Покупка сервера
app.post('/api/buy-server', auth, async (req, res) => {
  try {
    const { name, tariff, price } = req.body;
    
    if (req.user.balance < price) {
      return res.status(400).json({ error: 'Not enough balance' });
    }
    
    // Проверка на максимальное количество серверов
    if (req.user.servers.length >= 5) {
      return res.status(400).json({ error: 'Maximum number of servers reached' });
    }
    
    // Создание сервера в Pterodactyl
    const pterodactylServer = await pterodactyl.createServer({
      name: name,
      user: req.user.pterodactylId,
      egg: 1, // ID яйца (egg) в Pterodactyl
      docker_image: "quay.io/pterodactyl/core:java",
      startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
      environment: {
        SERVER_JARFILE: "server.jar",
        SERVER_MEMORY: "1024"
      },
      limits: {
        memory: 1024,
        swap: 0,
        disk: 10000,
        io: 500,
        cpu: 100
      },
      feature_limits: {
        databases: 5,
        allocations: 1
      }
    });
    
    req.user.balance -= price;
    req.user.servers.push({
      name,
      tariff,
      price,
      date: new Date(),
      pterodactylServerId: pterodactylServer.id
    });
    
    await req.user.save();
    
    res.json({
      success: true,
      balance: req.user.balance,
      servers: req.user.servers
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 