// Radar PRO v4 API
// backend/server.js

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ===== CSV LOCATION =====
// Render will run inside /opt/render/project/src/backend
// Data folder is one level up
const CSV_PATH = path.join(__dirname, "../data/Radar_PRO_GOOGLE_MYMAPS_READY.csv");

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.send("Radar PRO API running");
});

// ===== /data ROUTE (FIXED) =====
app.get("/data", (req, res) => {
  const results = [];

  if (!fs.existsSync(CSV_PATH)) {
    return res.status(500).json({
      error: "CSV not found",
      path: CSV_PATH
    });
  }

  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      res.json(results);
    })
    .on("error", (err) => {
      res.status(500).json({
        error: "CSV parse error",
        details: err.message
      });
    });
});

app.listen(PORT, () => {
  console.log(`Radar PRO API running on port ${PORT}`);
});
