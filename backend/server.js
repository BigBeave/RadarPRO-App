/**
 * Radar PRO Backend - LIVE DATA ENGINE
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = process.env.PORT || 5000;

/*
==================================================
SMART CSV PATH (LOCAL + CLOUD AUTO DETECT)
==================================================
*/

// Render runs inside /opt/render/project/src
// Local runs on Windows D:\
// We detect automatically.

const LOCAL_PATH =
  "D:\\RadarPRO-App\\data\\Radar_PRO_GOOGLE_MYMAPS_READY.csv";

const CLOUD_PATH = path.join(
  __dirname,
  "..",
  "data",
  "Radar_PRO_GOOGLE_MYMAPS_READY.csv"
);

const CSV_PATH = fs.existsSync(LOCAL_PATH)
  ? LOCAL_PATH
  : CLOUD_PATH;

app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000"] }));

let CACHE = {
  prospects: [],
  rowCount: 0,
  loadedAt: null,
  loadError: null
};

function safeTrim(v){
  if(v === null || v === undefined) return "";
  return String(v).trim();
}

function toNumberOrNull(v){
  const s = safeTrim(v);
  if(!s) return null;
  const n = Number(s.replace(/[$,]/g,""));
  return Number.isFinite(n) ? n : null;
}

function loadCSV(){

  try{

    if(!fs.existsSync(CSV_PATH)){
      throw new Error("CSV NOT FOUND: " + CSV_PATH);
    }

    const raw = fs.readFileSync(CSV_PATH,"utf8");

    const records = parse(raw,{
      columns:true,
      skip_empty_lines:true,
      bom:true,
      relax_column_count:true
    });

    const normalized = records.map((row,idx)=>{

      const score = toNumberOrNull(row["Score"]);

      row.__id = idx+1;
      row.__score = score ?? 0;
      row.__company = safeTrim(row["Company"]);
      row.__city = safeTrim(row["City"]);
      row.__state = safeTrim(row["State"]);
      row.__zip = safeTrim(row["Zip"]);

      row.__highPriority = (score !== null && score > 0);

      return row;
    });

    CACHE.prospects = normalized;
    CACHE.rowCount = normalized.length;
    CACHE.loadedAt = new Date().toISOString();
    CACHE.loadError = null;

    console.log("Radar CSV Loaded:",CACHE.rowCount,"records");
    console.log("CSV PATH USED:",CSV_PATH);

  }catch(err){

    CACHE.prospects = [];
    CACHE.rowCount = 0;
    CACHE.loadError = err.message;
    console.log("CSV LOAD ERROR:",err.message);
  }
}

loadCSV();

/* ================= API ================= */

app.get("/api/health",(req,res)=>{
  res.json({
    ok:true,
    rowCount:CACHE.rowCount,
    loadedAt:CACHE.loadedAt,
    loadError:CACHE.loadError
  });
});

app.get("/api/stats",(req,res)=>{
  const total = CACHE.prospects.length;
  const highPriority = CACHE.prospects.filter(r=>r.__highPriority).length;

  res.json({
    ok:true,
    total,
    highPriority
  });
});

app.get("/api/prospects",(req,res)=>{

  let rows = CACHE.prospects;

  const highPriorityOnly =
    String(req.query.highPriorityOnly || "false") === "true";

  if(highPriorityOnly){
    rows = rows.filter(r=>r.__highPriority);
  }

  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 200);

  const start = (page-1)*pageSize;
  const end = start + pageSize;

  res.json({
    ok:true,
    rows: rows.slice(start,end),
    total: rows.length
  });
});

/* ================= START SERVER ================= */

app.listen(PORT,()=>{
  console.log("Radar PRO backend running on port",PORT);
});
