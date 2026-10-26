import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URL);
await client.connect();

const db = client.db("backend");
const users = db.collection("users");

if ((await users.countDocuments()) === 0) {
    await users.insertOne({
        _id: "admin",
        username: "admin",
        role: "admin",
        passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10)
    });
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "backend",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 30
  }
}));

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "authentication required" });
    }
    next();
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.session.user?.role !== role) {
            return res.status(403).json({ error: `${role} role required` });
        }
        next();
    };
}

app.get('/api/users', requireAuth, requireRole("admin"), async (_req, res) => {
    const result = await users.find({}, { username: true, role: true }).toArray();
    res.json(result);
});

app.post('/api/signin', async (req, res) => {
    const username = (req.body?.email ?? "").trim();
    const password = req.body?.password ?? "";
    const user = await users.findOne({ _id: username });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "invalid credentials" });
    }
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json(req.session.user);
});

app.post('/api/signoff', async (req, res) => {
    req.session.destroy(() => res.status(204).end());
});

app.post('/api/signup', async (req, res) => {
    const user = {
        username: (req.body?.username ?? "").trim(),
        role: "user",
        name: (req.body?.name ?? "").trim(),
        email: (req.body?.email ?? "").trim(),
        passwordHash: bcrypt.hashSync(req.body?.password ?? "", 10)
    };
    try {
        await users.insertOne({ _id: user.username, ...user });
        res.status(201).end();
    } catch (e) {
        res.status(400).json({ error: "username taken" });
    }
});

app.listen(8080, "0.0.0.0");
