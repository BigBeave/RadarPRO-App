const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 10000;

/* ✅ CORS - LOCKED TO FRONTEND ONLY */
app.use(cors({
  origin: "https://radarpro-dashboard.onrender.com"
}));

/* ✅ RATE LIMITING - MAX 100 REQUESTS PER 15 MIN PER IP */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please try again later." }
});
app.use(limiter);

const CSV_PATH = path.join(__dirname, "../data/Radar_PRO_GOOGLE_MYMAPS_READY.csv");

/* ✅ IN-MEMORY CACHE */
let cachedData = null;

app.get("/", (req, res) => {
  res.send("Radar PRO API Running");
});

app.get("/data", (req, res) => {

  /* SERVE FROM CACHE IF AVAILABLE */
  if (cachedData) {
    console.log("Serving from cache");
    return res.json(cachedData);
  }

  res.setHeader("Content-Type", "application/json");

  const items = [];

  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on("data", (row) => {
      /* TRIM ALL KEY NAMES TO FIX CSV HEADER SPACING */
      let clean = {};
      Object.keys(row).forEach(k => {
        clean[k.trim()] = row[k];
      });
      items.push(clean);
    })
    .on("end", () => {
      cachedData = items;
      console.log(`CSV loaded: ${items.length} records cached`);
      res.json(items);
    })
    .on("error", (err) => {
      console.error("CSV STREAM ERROR:", err);
      res.status(500).json({ error: "CSV load failed" });
    });

});

/* ✅ CACHE BUSTING ENDPOINT - HIT THIS IF YOU UPDATE YOUR CSV */
app.get("/refresh", (req, res) => {
  cachedData = null;
  res.json({ message: "Cache cleared. Next /data request will reload CSV." });
});

app.listen(PORT, () => {
  console.log("Radar PRO API running on port " + PORT);
});
