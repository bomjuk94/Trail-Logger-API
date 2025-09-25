const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authenticateToken = require("../middleware/auth");

module.exports = (client, collections) => {
    const router = express.Router();
    const { users, profiles, trails } = collections;

    // Health check
    router.get("/ping", (_req, res) => {
        res.status(200).json({ ok: true, message: "pong" });
    });

    // Register
    router.post("/register", async (req, res) => {
        const { userName, password } = req.body;
        const { validateRegistrationInput } = require("../utils/validateUserInput");
        const userNameLower = userName.toLowerCase();

        const errors = validateRegistrationInput({ userName, password });
        if (errors.length > 0) return res.status(400).json({ errors });

        try {
            const existingUser = await users.findOne({ userName: userNameLower });
            if (existingUser) {
                return res.status(400).json({ error: "Account already registered" });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const createdAt = new Date().toISOString();

            const result = await users.insertOne({
                userName: userNameLower,
                password: hashedPassword,
                createdAt,
            });

            const newProfile = {
                _id: result.insertedId,
                userName: userNameLower,
                mode: "registered",
                height: null,
                weight: null,
                unit: null,
                timePreference: null,
                createdAt,
                lastActive: createdAt,
            };

            await profiles.insertOne(newProfile);

            const token = jwt.sign(
                { userId: result.insertedId, userName: userNameLower },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            res.json({ message: "User registered successfully", token });
        } catch (error) {
            console.error("Registration failed:", error);
            res.status(500).json({ error: "Registration failed" });
        }
    });

    // Login
    router.post("/login", async (req, res) => {
        const { userName, password } = req.body;
        const { validateLoginInput } = require("../utils/validateUserInput");
        const userNameLower = userName.toLowerCase();

        const errors = validateLoginInput({ userName, password });
        if (errors.length > 0) return res.status(400).json({ errors });

        try {
            const user = await users.findOne({ userName: userNameLower });
            if (!user) return res.status(401).json({ error: "Invalid credentials" });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

            const token = jwt.sign(
                { userId: user._id, userName: user.userName },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            res.json({ message: "User logged in successfully", token });
        } catch (error) {
            console.error("Login failed:", error);
            res.status(500).json({ error: "Login failed" });
        }
    });

    // Profile
    router.get("/profile", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson");
        const userId = new ObjectId(req.user.userId);

        try {
            const profile = await profiles.findOne({ _id: userId });
            if (!profile) return res.status(404).json({ error: "Profile not found" });

            res.json(profile);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Save profile
    router.put("/profile/save", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson");
        const userId = new ObjectId(req.user.userId);
        const {
            password,
            heightFeetNum,
            heightInchesNum,
            weightNum,
            isMetric,
            isPace,
        } = req.body;

        const { validateProfileUpdateInput } = require("../utils/validateUserInput");
        const errors = validateProfileUpdateInput({
            password,
            heightFeetNum,
            heightInchesNum,
            weightNum,
        });
        if (errors.length > 0) return res.status(400).json({ errors });

        const { feetInchesToMm, lbsToGrams, kgToGrams } = require("../utils/unitConverter");
        const heightMm = feetInchesToMm(heightFeetNum, heightInchesNum);
        const weightGrams = isMetric ? kgToGrams(weightNum) : lbsToGrams(weightNum);

        try {
            const profile = await profiles.findOne({ _id: userId });
            if (!profile) return res.status(404).json({ error: "Profile not found" });

            await profiles.updateOne(
                { _id: userId },
                {
                    $set: {
                        height: heightMm,
                        weight: weightGrams,
                        unit: isMetric ? "metric" : "imperial",
                        timePreference: isPace ? "pace" : "speed",
                    },
                }
            );

            if (password && password.trim() !== "") {
                const newPassword = await bcrypt.hash(password, 10);
                await users.updateOne(
                    { _id: userId },
                    { $set: { password: newPassword } }
                );
            }

            res.json({ message: "Profile updated successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Get trails
    router.get("/trails", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson");
        const userId = new ObjectId(req.user.userId);

        try {
            const trailsList = await trails.findOne({ _id: userId });
            if (!trailsList) return res.status(404).json({ error: "No trails found" });

            res.json(trailsList.hikes);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Save/update trail
    router.put("/trails/:id", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson");
        const userId = new ObjectId(req.user.userId);
        const trailId = req.params.id;
        const { started_at, ended_at, distance_m, duration_s, points_json } = req.body;

        const hike = {
            trailId,
            started_at,
            ended_at,
            distance_m,
            duration_s,
            points_json,
            updated_at: new Date(),
        };

        try {
            const insertRes = await trails.updateOne(
                { _id: userId, "hikes.trailId": { $ne: trailId } },
                {
                    $push: { hikes: { ...hike, created_at: new Date() } },
                    $setOnInsert: { _id: userId },
                },
                { upsert: true }
            );

            if (insertRes.modifiedCount === 1) {
                return res.json({ inserted: true });
            }

            const updateRes = await trails.updateOne(
                { _id: userId, "hikes.trailId": trailId },
                { $set: { ...hike } }
            );

            if (updateRes.matchedCount === 0) {
                return res.status(404).json({ error: "Hike not found" });
            }

            res.json({ updated: updateRes.modifiedCount === 1 });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Weather icon proxy
    router.get("/proxy/icon/:file", async (req, res) => {
        const file = req.params.file;
        const url = `https://openweathermap.org/img/wn/${file}`;
        try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            res.set("Content-Type", "image/png");
            res.set("Cross-Origin-Resource-Policy", "cross-origin");
            res.send(Buffer.from(buffer));
        } catch (error) {
            console.error("Icon proxy failed:", error);
            res.status(500).send("Icon fetch failed");
        }
    });

    return router;
};
