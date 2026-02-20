const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

/* ✅ ALLOW FRONTEND TO ACCESS API */
app.use(cors());

const CSV_PATH = path.join(__dirname, "../data/Radar_PRO_GOOGLE_MYMAPS_READY.csv");

app.get("/", (req, res) => {
  res.send("Radar PRO API Running");
});

app.get("/data", (req, res) => {

  res.setHeader("Content-Type", "application/json");

  const items = [];

  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on("data", (row) => {
      items.push(row);
    })
    .on("end", () => {
      res.json(items);   // ← your frontend expects RAW ARRAY
    })
    .on("error", (err) => {
      console.error("CSV STREAM ERROR:", err);
      res.status(500).json({ error: "CSV load failed" });
    });

});

app.listen(PORT, () => {
  console.log("Radar PRO API running on port " + PORT);
});