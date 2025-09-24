const express = require("express")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const authenticateToken = require("../middleware/auth")

module.exports = (client, collections) => {
    const router = express.Router()
    const { users, profiles, trails } = collections

    router.get('/ping', (_req, res) => {
        console.log('pong')
        res.status(200).send('pong')
    })

    router.post("/register", async (req, res) => {
        const { userName, password } = req.body
        const userNameCaseInsensitive = userName.toLowerCase()
        const { validateRegistrationInput } = require("../utils/validateUserInput")

        // Validate user inputs
        const errors = validateRegistrationInput({ userName, password })

        if (errors.length > 0) {
            return res.status(400).json({ errors })
        }

        try {
            // Check if user with userName already exists
            const existingUser = await users.findOne({ userName: userNameCaseInsensitive })

            if (existingUser) {
                return res.status(400).json({ error: "Account with userName already registered" })
            }
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10)
            const createdAt = new Date().toISOString()
            // Add new user (userName, password, createdAt)
            const result = await users.insertOne({
                userName: userNameCaseInsensitive,
                password: hashedPassword,
                createdAt,
            })

            // Add new profile to profiles collection

            const newProfile = {
                _id: result.insertedId,
                userName: userNameCaseInsensitive,
                mode: 'registered',
                height: null,
                weight: null,
                unit: null,
                timePreference: null,
                createdAt,
                lastActive: createdAt,
            }

            await profiles.insertOne(newProfile)

            // Create jwt token
            const token = jwt.sign(
                { userId: result.insertedId, userName: userNameCaseInsensitive },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            )

            return res.json({ message: "User registered successfully", token })
        } catch (error) {
            console.error("Registration failed:", error);
            res.status(500).json({ error: "Registration failed", details: error.message });
        }
    })

    router.post("/login", async (req, res) => {
        const { userName, password } = req.body;
        const { validateLoginInput } = require("../utils/validateUserInput");
        const userNameCaseInsensitive = userName.toLowerCase();
        console.log('logging user in...')
        console.log('usrname: ', userName, 'password', password)

        // Validate inputs
        console.log('validating...')
        const errors = validateLoginInput({ userName, password });
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        try {
            console.log('finding user...')
            const user = await users.findOne({ userName: userNameCaseInsensitive });
            if (!user) {
                return res.status(401).json({ error: "Invalid Credentials" });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: "Incorrect Credentials" });
            }

            console.log('signing jwt token...')
            const token = jwt.sign(
                { userId: user._id, userName: user.userName },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            console.log('success...')

            return res.json({ message: "User logged in successfully", token });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                error: {
                    "success": false,
                    "error": {
                        "code": "authenticationFailed",
                        "message": "Invalid credentials."
                    }
                }
            });
        }
    });


    router.get("/profile", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            // Check if user with _id exists in users collection
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }
            // Check if user with _id exists in profiles collection
            const profile = await profiles.findOne({ _id: userId })

            if (!profile) {
                return res.status(401).json({ error: "Profile does not exist" });
            }
            // Return profile data following Profile Type
            return res.json({
                ...profile
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/profile/save", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);
        const {
            password,
            heightFeetNum,
            heightInchesNum,
            weightNum,
            isMetric,
            isPace,
        } = req.body

        // Validate field values
        const { validateProfileUpdateInput } = require("../utils/validateUserInput")
        const errors = validateProfileUpdateInput({
            password,
            heightFeetNum,
            heightInchesNum,
            weightNum,
        })

        if (errors.length > 0) {
            return res.status(400).json({ errors })
        }

        // Convert height to milimeters
        const { feetInchesToMm, lbsToGrams, kgToGrams } = require("../utils/unitConverter")
        const heightMm = feetInchesToMm(heightFeetNum, heightInchesNum)
        // Convert weight to grams
        let weightGrams
        if (isMetric) {
            weightGrams = kgToGrams(weightNum)
        } else {
            weightGrams = lbsToGrams(weightNum)
        }

        try {
            // Check if user with _id exists in users collection

            const user = await users.findOne({ _id: userId });
            if (!user) return res.status(404).json({ error: "User does not exist" });

            const profile = await profiles.findOne({ _id: userId });
            if (!profile) return res.status(404).json({ error: "Profile does not exist" });

            if (!profile) {
                return res.status(401).json({ error: "Profile does not exist" });
            }

            // Update profile
            const resProfile = await profiles.updateOne(
                { _id: userId },
                {
                    $set: {
                        height: heightMm,
                        weight: weightGrams,
                        unit: isMetric ? 'metric' : 'imperial',
                        timePreference: isPace ? 'pace' : 'speed',
                    }
                }
            )

            if (resProfile.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update profile." });
            }

            // Update password in auth
            if (password.trim() !== '') {
                // Hash new password
                const newPassword = await bcrypt.hash(password, 10)
                const resAuth = await users.updateOne(
                    { _id: userId },
                    {
                        $set: {
                            password: newPassword,
                        }
                    }
                )

                if (resAuth.modifiedCount === 0) {
                    return res.status(404).json({ error: "Could not update password." });
                }
            } else {
            }

            // return success response
            return res.json({
                message: "Profile updated successfully",
            });
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.get("/trails", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            // Check if user with _id exists in users collection
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }
            // Check if user with _id exists in profiles collection
            const trailsList = await trails.findOne({ _id: userId })

            if (!trailsList) {
                return res.status(402).json({ error: "Trails do not exist" });
            }
            // Return trails data following
            return res.json(trailsList.hikes)
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/trails/:id", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);
        const trailId = req.params.id
        const {
            started_at,
            ended_at,
            distance_m,
            duration_s,
            points_json,
        } = req.body

        try {

            const hike = {
                trailId,
                started_at,
                ended_at,
                distance_m,
                duration_s,
                points_json,
                updated_at: new Date(),
            }


            const insertRes = await trails.updateOne(
                { _id: userId, "hikes.trailId": { $ne: trailId } },
                {
                    $push: { hikes: { ...hike, created_at: new Date() } },
                    $setOnInsert: { _id: userId } // create the user doc if missing
                },
                { upsert: true }
            );

            if (insertRes.modifiedCount === 1) {
                // Successfully inserted new hike
                return res.json({ inserted: true });
            }

            const updateRes = await trails.updateOne(
                { _id: userId, "hikes.trailId": trailId },
                {
                    $set: {
                        "hikes.$.trailId": trailId,
                        "hikes.$.started_at": started_at,
                        "hikes.$.ended_at": ended_at,
                        "hikes.$.distance_m": distance_m,
                        "hikes.$.duration_s": duration_s,
                        "hikes.$.points_json": points_json,
                        "hikes.$.updated_at": new Date(),
                    }
                }
            );

            if (updateRes.matchedCount === 0) {
                // Should be rare (race conditions). Treat as not found.
                return res.status(404).json({ error: "Hike not found for update." });
            }

            return res.json({ updated: updateRes.modifiedCount === 1 });
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    // Express route
    router.get('/proxy/icon/:file', async (req, res) => {
        const file = req.params.file;
        const url = `https://openweathermap.org/img/wn/${file}`;
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        res.set('Content-Type', 'image/png');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // important
        res.send(Buffer.from(buffer));
    });

    return router
}