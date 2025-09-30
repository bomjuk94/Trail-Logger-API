if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = Number(process.env.PORT) || 8000;
let dbReady = false;
let client;

console.log("🚀 Server is starting...");

// --- Middleware ---
app.use(
    cors({
        origin: true, // TODO: tighten in production
    })
);
app.use(express.json());
app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms")
);

// --- Health checks ---
app.get("/api/ping", (_req, res) => {
    res.json({ ok: true, message: "pong" });
});

app.get("/api/ready", (_req, res) => {
    res.json({ dbReady });
});

// --- Start HTTP server immediately ---
app.listen(PORT, () => {
    console.log(`✅ API listening on port ${PORT}`);
});

// --- Mongo connection + routes ---
(async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("❌ Missing MONGO_URI env var");
        return;
    }

    try {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
        await client.connect();
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

        dbReady = true;
        console.log("✅ API routes mounted");
    } catch (err) {
        console.error("❌ MongoDB connection error:", err.message);
    }
})();

process.on("SIGTERM", async () => {
    try {
        await client?.close();
        console.log("👋 MongoDB connection closed");
    } catch (err) {
        console.error("Error during shutdown:", err.message);
    } finally {
        process.exit(0);
    }
});
