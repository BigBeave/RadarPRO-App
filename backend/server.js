// ============================================
// RadarPRO Backend Server - LIVE DATA VERSION
// ============================================

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(cors());
app.use(express.json());

// --------------------------------------------------
// PORT (Render uses environment PORT automatically)
// --------------------------------------------------
const PORT = process.env.PORT || 5000;

// --------------------------------------------------
// CSV LOCATION
// IMPORTANT:
// Works LOCAL and CLOUD without changing anything
// --------------------------------------------------
const CSV_PATH = path.join(__dirname, "..", "data", "Radar_PRO_GOOGLE_MYMAPS_READY.csv");

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------
app.get("/", (req, res) => {
  res.send("RadarPRO Backend LIVE");
});

// --------------------------------------------------
// 🔥 MAIN DATA ROUTE (THIS WAS MISSING)
// --------------------------------------------------
app.get("/data", (req, res) => {

  const results = [];

  // Check file exists
  if (!fs.existsSync(CSV_PATH)) {
    console.log("CSV NOT FOUND AT:", CSV_PATH);
    return res.status(500).json({ error: "CSV file not found" });
  }

  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on("data", (data) => {
      results.push(data);
    })
    .on("end", () => {

      console.log(`Loaded ${results.length} rows from CSV`);

      res.json({
        total: results.length,
        highPriority: results.filter(r => Number(r.Score || 0) >= 80).length,
        rows: results
      });

    })
    .on("error", (err) => {
      console.log("CSV READ ERROR:", err);
      res.status(500).json({ error: "Failed reading CSV" });
    });

});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`RadarPRO Backend running on port ${PORT}`);
});
