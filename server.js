// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
console.log("🚀 Server is starting...");

// ---------------------------------------------------------------------
// CORS CONFIG
// ---------------------------------------------------------------------

// Explicit dev origins (Expo web, Vite, Next, etc.)
const devOrigins = new Set([
    "http://localhost:19006", // Expo web dev
    "http://127.0.0.1:19006",
    "http://localhost:5173",  // Vite
    "http://localhost:5000",  // local API itself (for same-origin)
    "http://127.0.0.1:5000",
    "http://localhost:8081",
]);

// Allow adding extra origins via ENV (comma-separated list)
const envOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

envOrigins.forEach((o) => devOrigins.add(o));

function isAllowedOrigin(origin) {
    if (!origin) return true; // same-origin or tools like curl/Postman
    try {
        const u = new URL(origin);
        const host = u.host;

        if (devOrigins.has(origin)) return true;

        // ✅ allow Vercel deployments
        if (host.endsWith(".vercel.app")) return true;

        // ✅ allow HTTPS tunnels for testing on phone
        if (host.endsWith(".trycloudflare.com")) return true;
        if (host.endsWith(".ngrok-free.app") || host.endsWith(".ngrok.io")) return true;

        return false;
    } catch {
        return false;
    }
}

app.use(
    cors({
        origin: (origin, cb) => {
            console.log("🌍 Incoming origin:", origin);
            if (isAllowedOrigin(origin)) {
                cb(null, true);
            } else {
                console.warn("🚫 Blocked CORS request from:", origin);
                cb(null, false);
            }
        },
        methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: false, // set true only if you use cookies
        maxAge: 86400,
    })
);

// ---------------------------------------------------------------------
// EXPRESS MIDDLEWARE & ROUTES
// ---------------------------------------------------------------------
app.use(express.json());

app.get("/api/ping", (req, res) => {
    res.status(200).send("pong");
});

// ---------------------------------------------------------------------
// DATABASE
// ---------------------------------------------------------------------
const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

client
    .connect()
    .then(() => {
        console.log("✅ Connected to MongoDB Atlas");

        const authDB = client.db("auth");
        const userDataDB = client.db("userData");

        const collections = {
            users: authDB.collection("users"),
            profiles: userDataDB.collection("profiles"),
            trails: userDataDB.collection("trails"),
        };

        const authRoutes = require("./routes/auth")(client, collections);
        app.use("/api", authRoutes);

        // Error handler
        app.use((err, req, res, next) => {
            console.error("💥 Uncaught error: ", err);
            res.status(500).json({ error: "Internal server error" });
        });

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () =>
            console.log(`✅ Server running on http://localhost:${PORT}`)
        );
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error: ", err);
        process.exit(1);
    });



// require("dotenv").config()
// const express = require("express")
// const cors = require("cors");
// const { MongoClient } = require("mongodb")

// const app = express()
// console.log('server is starting')

// // TODO: Update for browser app
// const allowedOrigins = [
//     "http://localhost:5173",
//     "http://localhost:5000",
//     "http://10.0.2.2:5000",
//     "http://99.230.249.200:5000",
//     "http://localhost:8081",
//     // Production front client url (e.g. vercel)
// ];

// // TODO: Update for browser app
// app.use(cors({
//     origin: (origin, callback) => {
//         console.log("🌍 Incoming origin:", origin);

//         if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
//             callback(null, true); // ✅ allow
//         } else {
//             console.warn("🚫 Blocked CORS request from:", origin);
//             callback(null, false); // ✅ silently deny
//         }
//     },
//     credentials: true
// }));

// app.use(express.json())

// app.get('/api/ping', (req, res) => {
//     res.status(200).send('pong');
// });

// const client = new MongoClient(process.env.MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// })

// client.connect()
//     .then(() => {
//         console.log('Connected to MongoDB Atlas')

//         const authDB = client.db("auth")
//         const userDataDB = client.db("userData");

//         const collections = {
//             users: authDB.collection("users"),
//             profiles: userDataDB.collection("profiles"),
//             trails: userDataDB.collection("trails"),
//         };

//         const authRoutes = require("./routes/auth")(client, collections)
//         app.use("/api", authRoutes)

//         app.use((err, req, res, next) => {
//             console.error("Uncaught error: ", err)
//             res.status(500).json({ error: "Internal server error" })
//         })
//         const PORT = process.env.PORT || 5000
//         app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
//     })
//     .catch((err) => {
//         console.error("MongoDB connection error: ", err)
//         process.exit(1)
//     })