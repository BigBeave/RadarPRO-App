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

/* ✅ JSON BODY PARSER FOR POST REQUESTS */
app.use(express.json());

/* ✅ RATE LIMITING */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150, // Increased slightly to support API saves
  message: { error: "Too many requests. Please try again later." }
});
app.use(limiter);

/* ✅ ACCESS CONTROL PROTOCOL (GATEKEEPER) */
const ACCESS_KEY = process.env.ACCESS_KEY || "radar2026";
const checkAuth = (req, res, next) => {
  const clientKey = req.headers["x-access-key"];
  if (clientKey === ACCESS_KEY) {
    return next();
  }
  console.warn(`[Security Warning] Unauthorized access attempt from IP: ${req.ip}`);
  res.status(401).json({ error: "Access Denied. Invalid or missing access key." });
};

/* ✅ CSV PATH */
const CSV_PATH = path.join(__dirname, "../data/Radar_PRO_WITH_COORDS.csv");

/* ✅ IN-MEMORY CACHE */
let cachedData = null;

// Helper function to reliably load data as a Promise
function loadCSVData() {
  return new Promise((resolve, reject) => {
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
        resolve(items);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

app.get("/", (req, res) => {
  res.send("Radar PRO API Running - Phase 7 with Write-Back Support");
});

/* ✅ HEALTH CHECK */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "radarpro-api",
    phase: 7,
    csv_found: fs.existsSync(CSV_PATH),
    cached_records: cachedData ? cachedData.length : 0,
    github_sync_enabled: !!process.env.GITHUB_TOKEN
  });
});

/* ✅ MAIN DATA ENDPOINT */
app.get("/data", checkAuth, async (req, res) => {
  if (cachedData) {
    console.log("Serving from cache:", cachedData.length, "records");
    return res.json(cachedData);
  }

  try {
    const data = await loadCSVData();
    console.log("CSV loaded & cached:", data.length, "records");
    res.json(data);
  } catch (err) {
    console.error("CSV LOAD ERROR:", err);
    res.status(500).json({ error: "CSV load failed" });
  }
});

/* ✅ ADD PROSPECT ENDPOINT
   POST /api/prospect
   Accepts JSON, geocodes it, updates local file, clears cache, and pushes back to GitHub if enabled!
*/
app.post("/api/prospect", checkAuth, async (req, res) => {
  try {
    const { Company, Address, City, State, Zip, Phone, Website, Email, Description } = req.body;

    if (!Company || !Company.trim()) {
      return res.status(400).json({ error: "Company Name is required" });
    }

    console.log(`[API Write] Appending company: ${Company}`);

    // Ensure data is loaded to find max ID and headers
    if (!cachedData) {
      await loadCSVData();
    }

    // 1. Find maximum company ID
    let maxId = 0;
    cachedData.forEach(item => {
      const id = parseInt(String(item["Company ID"]).replace(/[^0-9]/g, "")) || 0;
      if (id > maxId) maxId = id;
    });
    const newId = maxId + 1;

    // 2. Geocode the address using Google (fallback to OpenStreetMap if needed)
    let lat = null;
    let lon = null;
    const fullAddr = [Address, City, State, Zip].filter(Boolean).join(", ");
    
    if (fullAddr) {
      const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyBkVk_B6cBwC9k4S7CL0nCPhsY75euyYoM";
      try {
        console.log(`🛰️  Geocoding upstream: "${fullAddr}"`);
        const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddr)}&key=${GOOGLE_API_KEY}`);
        const geoData = await geoRes.json();
        if (geoData.status === "OK" && geoData.results.length > 0) {
          const loc = geoData.results[0].geometry.location;
          lat = loc.lat;
          lon = loc.lng;
          console.log(`✅ Coordinates found: ${lat}, ${lon}`);
        }
      } catch (geoErr) {
        console.warn("⚠️ Geocoding call failed:", geoErr.message);
      }
    }

    // 3. Construct new row object matching CSV specification
    // Create a complete line matching raw header formats
    const rawHeaders = [
      "Score", "Industry Match ", "Company Size", "Match for my Products -Services",
      "Match for Pkg Sales ", "Company ID", "Business Description", "Address",
      "City", "        State", " Zip", "Phone", "Company Email", "Annual Sales",
      "Employees on Site", "Brand Names", "State Tag", "Company", "County",
      "Mailing Address", "Mailing City", "Mailing State", "Mailing Zip",
      "Alternate Phone", "Toll Free", "Fax", "Website", "Square Footage",
      "Year Established", "Area of Distribution", "Ownership", "Imports",
      "Woman Owned", "Minority Owned", "ISO Ratings", "Primary SIC Code",
      "SIC Code 2", "SIC Code 3", "SIC Code 4", "NAICS Code", "Executive 1 Salutation",
      "Executive 1 First Name", "Executive 1 Middle Name", "Executive 1 Last Name",
      "Executive 1 Suffix", "Executive 1 Title", "Executive 1 Abbreviated Title",
      "Executive 2 Salutation", "Executive 2 First Name", "Executive 2 Middle Name",
      "Executive 2 Last Name", "Executive 2 Suffix", "Executive 2 Title",
      "Executive 2 Abbreviated Title", "Executive 3 Salutation", "Executive 3 First Name",
      "Executive 3 Middle Name", "Executive 3 Last Name", "Executive 3 Suffix",
      "Executive 3 Title", "Executive 3 Abbreviated Title", "Executive 4 Salutation",
      "Executive 4 First Name", "Executive 4 Middle Name", "Executive 4 Last Name",
      "Executive 4 Suffix", "Executive 4 Title", "Executive 4 Abbreviated Title",
      "Executive 5 Salutation", "Executive 5 First Name", "Executive 5 Middle Name",
      "Executive 5 Last Name", "Executive 5 Suffix", "Executive 5 Title",
      "Executive 5 Abbreviated Title", "Executive 6 Salutation", "Executive 6 First Name",
      "Executive 6 Middle Name", "Executive 6 Last Name", "Executive 6 Suffix",
      "Executive 6 Title", "Executive 6 Abbreviated Title", "Executive 7 Salutation",
      "Executive 7 First Name", "Executive 7 Middle Name", "Executive 7 Last Name",
      "Executive 7 Suffix", "Executive 7 Title", "Executive 7 Abbreviated Title",
      "Executive 8 Salutation", "Executive 8 First Name", "Executive 8 Middle Name",
      "Executive 8 Last Name", "Executive 8 Suffix", "Executive 8 Title",
      "Executive 8 Abbreviated Title", "Executive 9 Salutation", "Executive 9 First Name",
      "Executive 9 Middle Name", "Executive 9 Last Name", "Executive 9 Suffix",
      "Executive 9 Title", "Executive 9 Abbreviated Title", "Executive 10 Salutation",
      "Executive 10 First Name", "Executive 10 Middle Name", "Executive 10 Last Name",
      "Executive 10 Suffix", "Executive 10 Title", "Executive 10 Abbreviated Title",
      "Lat", "Lon"
    ];

    const rowMap = {};
    rawHeaders.forEach(h => rowMap[h] = "");

    rowMap["Score"] = "15";
    rowMap["Company ID"] = String(newId);
    rowMap["Company"] = Company;
    rowMap["Address"] = Address || "";
    rowMap["City"] = City || "";
    rowMap["        State"] = State || "";
    rowMap[" Zip"] = Zip || "";
    rowMap["State Tag"] = State || "";
    rowMap["Phone"] = Phone || "";
    rowMap["Website"] = Website || "";
    rowMap["Company Email"] = Email || "";
    rowMap["Business Description"] = Description || "";
    rowMap["Lat"] = lat !== null ? String(lat) : "";
    rowMap["Lon"] = lon !== null ? String(lon) : "";

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const formattedCols = rawHeaders.map(h => escapeCSV(rowMap[h]));
    const csvLine = "\n" + formattedCols.join(",");

    // 4. Append to local CSV file immediately (guarantees persistence in local mode)
    fs.appendFileSync(CSV_PATH, csvLine, "utf-8");
    console.log("✅ Local CSV updated.");

    // 5. Instantly insert into memory cache so UI is immediate
    const cachedObj = {};
    rawHeaders.forEach(h => {
      cachedObj[h.trim()] = rowMap[h];
    });
    cachedObj.Score = 15;
    cachedObj.Lat = lat;
    cachedObj.Lon = lon;
    cachedData.push(cachedObj);

    res.json({
      success: true,
      message: "Prospect added to database successfully!",
      id: newId,
      lat,
      lon,
      company: Company
    });

    // 6. Perform Background Cloud Operations (GitHub & HubSpot Sync)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.REPO_OWNER || "BigBeave";
    const GITHUB_REPO  = process.env.REPO_NAME || "RadarPRO-App";
    const BRANCH       = process.env.BRANCH    || "phase7-radar-vision";
    const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

    // Execute all external APIs asynchronously in the background
    (async () => {
      // --- A. HUBSPOT CRM BRIDGE ---
      if (HUBSPOT_TOKEN) {
        console.log("🔗 Initiating CRM Sync to HubSpot...");
        try {
          const hubspotResp = await fetch("https://api.hubapi.com/crm/v3/objects/companies", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${HUBSPOT_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              properties: {
                name: Company,
                address: Address || "",
                city: City || "",
                state: State || "",
                zip: Zip || "",
                phone: Phone || "",
                website: Website || "",
                description: `RadarPRO System Created (ID: ${newId}). ${Description || ""}`.trim()
              }
            })
          });

          if (hubspotResp.ok) {
            const hubData = await hubspotResp.json();
            console.log(`✅ SUCCESS! Registered "${Company}" in HubSpot CRM. (ID: ${hubData.id})`);
          } else {
            const hubErr = await hubspotResp.text();
            console.error("❌ HubSpot API Sync Failed:", hubErr);
          }
        } catch (hsErr) {
          console.error("❌ HubSpot Bridge encountered an error:", hsErr.message);
        }
      }

      // --- B. GITHUB CLOUD WRITE-BACK ---
      if (GITHUB_TOKEN) {
        console.log("📤 Initiating Cloud Write-Back to GitHub...");
        try {
          const filePath = "data/Radar_PRO_WITH_COORDS.csv";
          const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
          
          const getResp = await fetch(apiUrl + `?ref=${BRANCH}`, {
            headers: {
              "Authorization": `Bearer ${GITHUB_TOKEN}`,
              "Accept": "application/vnd.github.v3+json"
            }
          });
          
          if (!getResp.ok) throw new Error(`Failed to fetch SHA: ${getResp.status}`);
          const fileMeta = await getResp.json();
          const currentSha = fileMeta.sha;
          
          const updatedCsvContent = fs.readFileSync(CSV_PATH, "utf-8");
          const base64Content = Buffer.from(updatedCsvContent).toString("base64");
          
          const putResp = await fetch(apiUrl, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${GITHUB_TOKEN}`,
              "Accept": "application/vnd.github.v3+json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              message: `Added prospect via Web UI: ${Company} [HubSpot Sync]`,
              content: base64Content,
              sha: currentSha,
              branch: BRANCH
            })
          });
          
          if (putResp.ok) {
            console.log("🎉 SUCCESS! Pushed CSV changes to GitHub Repository.");
          } else {
            console.error("❌ GitHub API Commit Failed.");
          }
        } catch (bgErr) {
          console.error("❌ Background GitHub synchronization failed:", bgErr.message);
        }
      } else {
        console.warn("⚠️ GitHub integration skipped (No GITHUB_TOKEN configured).");
      }
    })();

  } catch (err) {
    console.error("❌ [API WRITE ERROR]:", err);
    res.status(500).json({ error: "Failed to add company.", message: err.message });
  }
});

/* ✅ RADIUS SEARCH ENDPOINT */
app.get("/radius", checkAuth, (req, res) => {
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
    .sort((a, b) => a._distance - b._distance);

  res.json({
    count: results.length,
    center: { lat, lon },
    radius_miles: miles,
    keyword: keyword || null,
    results
  });
});

/* ✅ GEOCODE PROXY */
let lastGeocodeAt = 0;
const GEOCODE_MIN_MS = 1100;

app.get("/geocode", checkAuth, async (req, res) => {
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

/* ✅ CACHE BUST */
app.get("/refresh", checkAuth, (req, res) => {
  cachedData = null;
  res.json({ message: "Cache cleared. Next /data request reloads CSV." });
});

app.listen(PORT, () => {
  console.log("Radar PRO API Phase 7 Running on port " + PORT);
  console.log("CSV_PATH=" + CSV_PATH);
});
