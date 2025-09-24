// server.js
if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { MongoClient } = require('mongodb');

const app = express();
console.log('🚀 Server is starting...');

// ---- CORS: allow everything while debugging (credentials: false) ----
app.use(cors({ origin: true })); // or origin: '*'
app.use(express.json());
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Health endpoints always available
app.get('/api/ping', (_req, res) => res.status(200).send('pong'));
let dbReady = false;
app.get('/api/ready', (_req, res) => res.json({ dbReady }));

// Start HTTP server immediately so health checks & ping work
const PORT = Number(process.env.PORT) || 8000;
app.listen(PORT, () => console.log(`✅ API listening on port ${PORT}`));

// ---- Connect to Mongo in background; mount routes when ready ----
const uri = process.env.MONGO_URI;
let client;

(async () => {
    if (!uri) {
        console.error('❌ Missing MONGO_URI env var'); return;
    }
    try {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
        await client.connect();
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

        dbReady = true;
        console.log('✅ API routes mounted');
    } catch (err) {
        console.error('❌ MongoDB connection error (server still running):', err?.message);
        // Optionally retry later
    }
})();

process.on('SIGTERM', async () => { try { await client?.close(); } catch { } process.exit(0); });
