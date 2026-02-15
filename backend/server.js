const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parse/sync");

const app = express();

/*
==============================
PORT HANDLING (LOCAL + RENDER)
==============================
*/
const PORT = process.env.PORT || 5000;

/*
==============================
CSV PATH FIX (THIS IS THE BIG ONE)
NO MORE D:\ PATHS
Render needs relative paths
==============================
*/
const CSV_PATH = path.join(
  __dirname,
  "..",
  "data",
  "Radar_PRO_GOOGLE_MYMAPS_READY.csv"
);

console.log("CSV PATH:", CSV_PATH);

/*
==============================
LOAD CSV
==============================
*/
let radarData = [];

try {
  const file = fs.readFileSync(CSV_PATH);
  radarData = csv.parse(file, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Radar CSV Loaded: ${radarData.length} records`);
} catch (err) {
  console.error("CSV LOAD ERROR:", err.message);
}

/*
==============================
API ROUTE
==============================
*/
app.get("/api/radar", (req, res) => {
  res.json(radarData);
});

/*
==============================
HEALTH CHECK
==============================
*/
app.get("/", (req, res) => {
  res.send("RadarPRO Backend Running");
});

/*
==============================
START SERVER
==============================
*/
app.listen(PORT, () => {
  console.log(`Radar PRO backend running on port ${PORT}`);
});
