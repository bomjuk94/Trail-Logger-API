// server.js
// Only read .env locally
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
console.log('🚀 Server is starting...');

// ---------- CORS ----------
const devOrigins = new Set([
    'http://localhost:19006',
    'http://127.0.0.1:19006',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:8081',
    'http://localhost:8000',
]);

(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => devOrigins.add(o));

function isAllowedOrigin(origin) {
    console.log('checking allowed origins')
    if (!origin) return true;
    try {
        const u = new URL(origin);
        const host = u.host;
        console.log('host', host)
        if (devOrigins.has(origin)) return true;
        if (host.endsWith('.vercel.app')) return true;          // your web client
        if (host.endsWith('.trycloudflare.com')) return true;   // tunnels
        if (host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok.io')) return true;
        return false;
    } catch {
        return false;
    }
}

app.use(
    cors({
        origin: (origin, cb) => {
            console.log('🌍 Incoming origin:', origin);
            isAllowedOrigin(origin) ? cb(null, true) : cb(null, false);
        },
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: false,
        maxAge: 86400,
    })
);

// ---------- Middleware & routes ----------
app.use(express.json());
app.get('/api/ping', (_req, res) => res.status(200).send('pong'));

// ---------- Database ----------
const uri = process.env.MONGO_URI;
if (!uri) {
    console.error('❌ Missing MONGO_URI env var');
    process.exit(1);
}

// mongodb@6: remove deprecated options, ensure TLS for non-SRV URIs
const client = new MongoClient(uri, { tls: true, serverSelectionTimeoutMS: 10000 });

client.connect()
    .then(() => {
        console.log('✅ Connected to MongoDB Atlas');

        const authDB = client.db('auth');
        const userDataDB = client.db('userData');

        const collections = {
            users: authDB.collection('users'),
            profiles: userDataDB.collection('profiles'),
            trails: userDataDB.collection('trails'),
        };

        const authRoutes = require('./routes/auth')(client, collections);
        app.use('/api', authRoutes);

        // Error handler
        app.use((err, _req, res, _next) => {
            console.error('💥 Uncaught error: ', err);
            res.status(500).json({ error: 'Internal server error' });
        });

        // 🔴 IMPORTANT: listen on Koyeb's PORT (defaults to 8000)
        const PORT = Number(process.env.PORT) || 8000;
        app.listen(PORT, () => console.log(`✅ API listening on port ${PORT}`));
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error: ', err);
        process.exit(1);
    });

// graceful shutdown
process.on('SIGTERM', async () => { try { await client?.close(); } catch { } process.exit(0); });
