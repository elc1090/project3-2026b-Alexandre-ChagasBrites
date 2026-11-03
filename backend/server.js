import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URL || "mongodb+srv://acbrites_db_user:LLsoJSue1qbrjid7@tiny-swords.7fozaib.mongodb.net/");
await client.connect();

const db = client.db("backend");
const users = db.collection("users");

if ((await users.countDocuments()) === 0) {
    await users.insertOne({
        _id: "admin",
        username: "admin",
        role: "admin",
        passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || "tiny-swords-admin", 10)
    });
}

const app = express();
app.use(cors({
    origin: (origin, callback) => {
        console.log(`origin: ${origin}`);
        callback(null, {
            origin,
            credentials: true
        });
    },
    credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "tiny-swords-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  }
}));

function requireAuth(req, res, next) {
    console.log(`sessionId: ${req.sessionID}`);
    console.log(req.session.user);
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

app.get('/api/me', requireAuth, async (req, res) => {
    const projection = { _id: false, passwordHash: false };
    const user = await users.findOne({ _id: req.session.user.username }, { projection });
    res.json(user);
});

app.get('/api/users', requireAuth, requireRole("admin"), async (_req, res) => {
    const result = await users.find({}, { username: true, role: true }).toArray();
    res.json(result);
});

app.post('/api/signin', async (req, res) => {
    const username = (req.body?.username ?? "").trim();
    const password = req.body?.password ?? "";
    const user = await users.findOne({ _id: username });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "invalid credentials" });
    }
    req.session.regenerate((err) => {
        if (err) {
            next(err);
        }
        req.session.user = { username: user.username, role: user.role };
        req.session.save((err) => {
            if (err) {
                next(err);
            }
            res.json(req.session.user);
            console.log(`sessionId: ${req.sessionID}`);
            console.log(req.session.user);
        });
    });
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
