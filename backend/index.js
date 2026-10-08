import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/signin', (req, res) => {
    console.log(req.body);
    res.status(200).end();
});

app.post('/api/signup', (req, res) => {
    console.log(req.body);
    res.status(200).end();
});

app.listen(3000, "0.0.0.0");
