const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

const DATA_PATH = path.join(__dirname, "../data/Radar_PRO_GOOGLE_MYMAPS_READY.csv");

app.get("/", (req, res) => {
  res.send("Radar PRO API running");
});

/*
   MEMORY SAFE DATA ROUTE
   Streams CSV instead of loading whole file into RAM
*/
app.get("/data", (req, res) => {

  const results = [];

  fs.createReadStream(DATA_PATH)
    .pipe(csv())
    .on("data", (row) => {
      results.push(row);
    })
    .on("end", () => {
      res.json(results);
    })
    .on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "Failed to read CSV" });
    });

});

app.listen(PORT, () => {
  console.log(`Radar PRO API running on port ${PORT}`);
});
