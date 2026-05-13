const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 10000;

/* ✅ CORS - ALLOW DESKTOP + CLOUD FRONTENDS */
app.use(cors());

/* ✅ RATE LIMITING */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please try again later." }
});
app.use(limiter);

/* ✅ UPDATED CSV PATH - NOW WITH COORDINATES */
const CSV_PATH = path.join(__dirname, "../data/Radar_PRO_WITH_COORDS.csv");

/* ✅ IN-MEMORY CACHE */
let cachedData = null;

app.get("/", (req, res) => {
  res.send("Radar PRO API Running - Phase 4");
});

/* ✅ HEALTH CHECK */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "radarpro-api",
    phase: 4,
    csv_found: fs.existsSync(CSV_PATH),
    cached_records: cachedData ? cachedData.length : 0
  });
});

/* ✅ MAIN DATA ENDPOINT */
app.get("/data", (req, res) => {
  if (cachedData) {
    console.log("Serving from cache:", cachedData.length, "records");
    return res.json(cachedData);
  }

  res.setHeader("Content-Type", "application/json");
  const items = [];

  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on("data", (row) => {
      let clean = {};
      Object.keys(row).forEach(k => {
        clean[k.trim()] = typeof row[k] === "string" ? row[k].trim() : row[k];
      });
      clean.Score = Number(clean.Score || 0);
      clean.Lat   = parseFloat(clean.Lat) || null;
      clean.Lon   = parseFloat(clean.Lon) || null;
      items.push(clean);
    })
    .on("end", () => {
      cachedData = items;
      console.log("CSV loaded:", items.length, "records cached");
      res.json(items);
    })
    .on("error", (err) => {
      console.error("CSV STREAM ERROR:", err);
      res.status(500).json({ error: "CSV load failed" });
    });
});

/* ✅ RADIUS SEARCH ENDPOINT
   GET /radius?lat=41.5&lon=-81.7&miles=35&keyword=metal
   Returns all prospects within X miles of a point
*/
app.get("/radius", (req, res) => {
  const lat     = parseFloat(req.query.lat);
  const lon     = parseFloat(req.query.lon);
  const miles   = Math.min(parseFloat(req.query.miles) || 35, 200);
  const keyword = (req.query.keyword || "").toLowerCase().trim();

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: "Missing lat/lon parameters" });
  }

  if (!cachedData) {
    return res.status(503).json({ error: "Data not loaded yet. Try /data first." });
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  let results = cachedData
    .filter(o => {
      if (!o.Lat || !o.Lon) return false;
      if (keyword) {
        const match = Object.values(o).some(v =>
          String(v).toLowerCase().includes(keyword)
        );
        if (!match) return false;
      }
      const dist = haversine(lat, lon, o.Lat, o.Lon);
      if (dist > miles) return false;
      o._distance = Math.round(dist * 10) / 10;
      return true;
    })
    .sort((a, b) => a._distance - b._distance); // Sort by closest first

  res.json({
    count: results.length,
    center: { lat, lon },
    radius_miles: miles,
    keyword: keyword || null,
    results
  });
});

/* ✅ GEOCODE PROXY - converts address/zip to lat/lon */
let lastGeocodeAt = 0;
const GEOCODE_MIN_MS = 1100;

app.get("/geocode", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing query param: q" });

    const now = Date.now();
    if (now - lastGeocodeAt < GEOCODE_MIN_MS) {
      return res.status(429).json({ error: "Rate limited. Try again in a second." });
    }
    lastGeocodeAt = now;

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q + ", USA");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "us");

    const resp = await fetch(url.toString(), {
      headers: {
        "User-Agent": "ProspectRadarPRO/4.0 (contact:admin@sdpinc.net)",
        "Accept": "application/json"
      }
    });

    if (!resp.ok) throw new Error("Geocode upstream error: " + resp.status);

    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      return res.json({ found: false });
    }

    return res.json({
      found: true,
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      display_name: data[0].display_name
    });

  } catch (err) {
    res.status(500).json({ error: "Geocode error", message: err.message });
  }
});

/* ✅ CACHE BUST - hit this after updating CSV */
app.get("/refresh", (req, res) => {
  cachedData = null;
  res.json({ message: "Cache cleared. Next /data request reloads CSV." });
});

app.listen(PORT, () => {
  console.log("Radar PRO API Phase 4 running on port " + PORT);
  console.log("CSV_PATH=" + CSV_PATH);
});
