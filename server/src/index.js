const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");
const apiRouter = require("./routes/api");

// Load defaults first, then local overrides; force values from files to win over stale shell env.
dotenv.config({ path: ".env.example", override: true });
dotenv.config({ path: ".env", override: true });

const app = express();
const port = Number(process.env.API_PORT || 8787);
const host = process.env.API_HOST || "0.0.0.0";
const frontendOrigin = process.env.FRONTEND_ORIGIN || "*";
const corsOrigin = frontendOrigin === "*" ? true : frontendOrigin;

app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(cors({
  origin: corsOrigin,
  credentials: false
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "whimsical-wands-api",
    health: "/api/health"
  });
});

app.use("/api", (req, res, next) => {
  // Auth/admin checks must always reflect current server state.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
}, apiRouter);
app.use("/backups", express.static(require("node:path").join(__dirname, "..", "..", "backups")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, host, () => {
  console.log("Whimsical Wands API listening on http://" + host + ":" + port);
});
