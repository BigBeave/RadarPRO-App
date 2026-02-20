const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
const PORT = process.env.PORT || 10000;

/*
  ✅ IMPORTANT:
  CSV is inside /data folder
*/
const CSV_PATH = path.join(__dirname, "../data/Radar_PRO_GOOGLE_MYMAPS_READY.csv");

app.get("/", (req, res) => {
  res.send("Radar PRO API Running");
});

/*
  MEMORY SAFE STREAMING ROUTE
  Does NOT load entire CSV into RAM
*/
app.get("/data", (req, res) => {

  res.setHeader("Content-Type", "application/json");

  const items = [];

  const stream = fs.createReadStream(CSV_PATH)
    .pipe(csv());

  stream.on("data", (row) => {
    items.push(row);
  });

  stream.on("end", () => {
    res.json({ items });
  });

  stream.on("error", (err) => {
    console.error("CSV STREAM ERROR:", err);
    res.status(500).json({ error: "CSV load failed" });
  });

});

app.listen(PORT, () => {
  console.log("Radar PRO API running on port " + PORT);
});