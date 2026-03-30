const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-for-production";
const dbPath = path.join(__dirname, "data", "keep-notes.db");

app.use(cors());
app.use(express.json({ limit: "100kb" }));

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function createId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing authentication token." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", async (req, res) => {
  const email = sanitizeText(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);
  if (existing) {
    return res.status(409).json({ message: "Email already registered." });
  }

  const id = createId();
  const createdAt = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare(
    "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, email, passwordHash, createdAt);

  const user = { id, email, createdAt };
  const token = createToken(user);

  return res.status(201).json({ token, user });
});

app.post("/api/auth/login", async (req, res) => {
  const email = sanitizeText(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = db
    .prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?")
    .get(email);

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const passwordMatched = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatched) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = createToken(user);
  return res.json({
    token,
    user: { id: user.id, email: user.email, createdAt: user.created_at },
  });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const user = db
    .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
    .get(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  return res.json({
    user: { id: user.id, email: user.email, createdAt: user.created_at },
  });
});

app.get("/api/notes", authMiddleware, (req, res) => {
  const notes = db
    .prepare(
      "SELECT id, title, content, created_at as createdAt, updated_at as updatedAt FROM notes WHERE user_id = ? ORDER BY updated_at DESC"
    )
    .all(req.user.id);
  return res.json({ notes });
});

app.post("/api/notes", authMiddleware, (req, res) => {
  const title = sanitizeText(req.body?.title, 120);
  const content = sanitizeText(req.body?.content, 5000);

  if (!title && !content) {
    return res.status(400).json({ message: "Note title or content is required." });
  }

  const id = createId();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO notes (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, req.user.id, title, content, now, now);

  return res.status(201).json({
    note: { id, title, content, createdAt: now, updatedAt: now },
  });
});

app.put("/api/notes/:id", authMiddleware, (req, res) => {
  const noteId = sanitizeText(req.params.id, 64);
  const title = sanitizeText(req.body?.title, 120);
  const content = sanitizeText(req.body?.content, 5000);

  const note = db
    .prepare("SELECT id FROM notes WHERE id = ? AND user_id = ?")
    .get(noteId, req.user.id);
  if (!note) {
    return res.status(404).json({ message: "Note not found." });
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  ).run(title, content, now, noteId, req.user.id);

  return res.json({
    note: { id: noteId, title, content, updatedAt: now },
  });
});

app.delete("/api/notes/:id", authMiddleware, (req, res) => {
  const noteId = sanitizeText(req.params.id, 64);
  const result = db
    .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
    .run(noteId, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ message: "Note not found." });
  }

  return res.status(204).send();
});

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Keep Notes backend running on http://localhost:${PORT}`);
});
