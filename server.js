require("dotenv").config();

const express = require("express");
const Database = require("better-sqlite3");
const rateLimit = require("express-rate-limit");

const app = express();
const db = new Database("quickcuts.db");
const PORT = 3000;

app.use(express.json());

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        error: "Too many requests, please try again later."
    }
});

app.use(limiter);

db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerName TEXT NOT NULL,
        serviceType TEXT NOT NULL CHECK(serviceType IN ('Haircut', 'Shave', 'Haircut + Shave')),
        status TEXT NOT NULL CHECK(status IN ('Waiting', 'In Chair', 'Done')),
        timeIn TEXT NOT NULL
    )
`);

function validateQueue(data) {
    const errors = [];

    if (!data.customerName || typeof data.customerName !== "string" ||
        data.customerName.trim() === "") {
        errors.push("customerName is required.");
    }

    const allowedServices = ["Haircut", "Shave", "Haircut + Shave"];

    if (!allowedServices.includes(data.serviceType)) {
        errors.push("serviceType must be one of: " + allowedServices.join(", ") + ".");
    }

    return errors;
}

function requireApiKey(req, res, next) {
    console.log("Server API Key:", process.env.API_KEY);

    const key = req.headers["x-api-key"];

    if (!key || key !== process.env.API_KEY) {
        const error = new Error("Invalid or missing API key.");
        error.statusCode = 401;
        return next(error);
    }

    next();
}

app.get("/queue", (req, res, next) => {
    try {
        const rows = db.prepare("SELECT * FROM queue ORDER BY id").all();
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

app.get("/queue/:id", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const row = db.prepare("SELECT * FROM queue WHERE id = ?").get(id);

        if (!row) {
            const error = new Error("Queue entry not found.");
            error.statusCode = 404;
            throw error;
        }

        res.json(row);
    } catch (error) {
        next(error);
    }
});

app.post("/queue", requireApiKey, (req, res, next) => {
    try {
        const errors = validateQueue(req.body);

        if (errors.length > 0) {
            const error = new Error(errors.join(" "));
            error.statusCode = 400;
            throw error;
        }

        const timeIn = new Date().toLocaleTimeString();

        const result = db.prepare(`
            INSERT INTO queue (customerName, serviceType, status, timeIn)
            VALUES (?, ?, ?, ?)
        `).run(
            req.body.customerName.trim(),
            req.body.serviceType,
            "Waiting",
            timeIn
        );

        const newEntry = db
            .prepare("SELECT * FROM queue WHERE id = ?")
            .get(result.lastInsertRowid);

        res.status(201).json(newEntry);
    } catch (error) {
        next(error);
    }
});

app.put("/queue/:id", requireApiKey, (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const allowedStatuses = ["Waiting", "In Chair", "Done"];

        const existing = db
            .prepare("SELECT * FROM queue WHERE id = ?")
            .get(id);

        if (!existing) {
            const error = new Error("Queue entry not found.");
            error.statusCode = 404;
            throw error;
        }

        const errors = [];

        if (!allowedStatuses.includes(req.body.status)) {
            errors.push(
                "status must be one of: " + allowedStatuses.join(", ") + "."
            );
        }

        if (errors.length > 0) {
            const error = new Error(errors.join(" "));
            error.statusCode = 400;
            throw error;
        }

        db.prepare(`
            UPDATE queue
            SET status = ?
            WHERE id = ?
        `).run(req.body.status, id);

        const updated = db
            .prepare("SELECT * FROM queue WHERE id = ?")
            .get(id);

        res.json(updated);
    } catch (error) {
        next(error);
    }
});

app.delete("/queue/:id", requireApiKey, (req, res, next) => {
    try {
        const id = Number(req.params.id);

        const existing = db
            .prepare("SELECT * FROM queue WHERE id = ?")
            .get(id);

        if (!existing) {
            const error = new Error("Queue entry not found.");
            error.statusCode = 404;
            throw error;
        }

        db.prepare("DELETE FROM queue WHERE id = ?").run(id);

        res.json({
            message: "Queue entry deleted successfully.",
            removed: existing
        });
    } catch (error) {
        next(error);
    }
});

app.use((err, req, res, next) => {
    console.error(err.message);

    res.status(err.statusCode || 500).json({
        error: err.message || "Internal server error."
    });
});

app.listen(PORT, () => {
    console.log(`QuickCuts Queue API running at http://localhost:${PORT}`);
});
