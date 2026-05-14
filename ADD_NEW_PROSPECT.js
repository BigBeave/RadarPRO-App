const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Use standard Node tools to parse CSV manually to avoid dependency issues
function parseCSVLine(line) {
  const result = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  result.push(cell.trim());
  return result;
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('\n=======================================================');
  console.log('          ➕  RADAR PRO - ADD NEW PROSPECT             ');
  console.log('=======================================================\n');

  const company = await askQuestion('🏢 Company Name  : ');
  if (!company) {
    console.log('ERROR: Company Name is required.');
    process.exit(1);
  }

  const street = await askQuestion('📍 Street Address: ');
  const city = await askQuestion('🏙️  City          : ');
  const state = await askQuestion('🇺🇸 State (ex. MI): ');
  const zip = await askQuestion('📪 Zip Code      : ');
  const phone = await askQuestion('📞 Phone Number  : ');
  const website = await askQuestion('🌐 Website URL   : ');
  const email = await askQuestion('📧 Company Email : ');
  const description = await askQuestion('📝 Notes / Description: ');

  console.log('\n--- Processing Request ---');

  const API_KEY = 'AIzaSyBkVk_B6cBwC9k4S7CL0nCPhsY75euyYoM';
  const CSV_PATH = path.join(__dirname, 'data', 'Radar_PRO_WITH_COORDS.csv');

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: CSV file not found at ${CSV_PATH}`);
    process.exit(1);
  }

  // Read existing records to get headers and generate ID
  const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Track existing IDs to find max ID
  let maxId = 0;
  const companyIdIndex = headers.findIndex(h => h.toLowerCase().includes('company id'));
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const idStr = cols[companyIdIndex] || '0';
    const id = parseInt(idStr.replace(/[^0-9]/g, '')) || 0;
    if (id > maxId) maxId = id;
  }

  const newId = maxId + 1;
  console.log(`🎯 Assigned New Company ID: ${newId}`);

  // Geocoding
  let lat = '';
  let lon = '';
  const fullAddr = [street, city, state, zip].filter(Boolean).join(', ');

  if (fullAddr) {
    console.log(`🛰️  Geocoding: "${fullAddr}"...`);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddr)}&key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results.length > 0) {
        const loc = data.results[0].geometry.location;
        lat = loc.lat;
        lon = loc.lng;
        console.log(`✅ Coordinates found: ${lat}, ${lon}`);
      } else {
        console.log('⚠️  Geocoding returned no results. Storing without exact map pin.');
      }
    } catch (e) {
      console.log('⚠️  Geocode connection failed. Storing without exact map pin.');
    }
  } else {
    console.log('⚠️  No address entered. Skipping geocoding.');
  }

  // Create map of new values
  // Be highly careful to match exact header spacing for the system
  const valuesMap = {};
  headers.forEach(h => {
    valuesMap[h] = '';
  });

  // Fill primary data fields
  valuesMap['Score'] = '15'; // Default score for manually added
  valuesMap['Company ID'] = String(newId);
  valuesMap['Company'] = company;
  valuesMap['Address'] = street;
  valuesMap['City'] = city;
  
  // Match the weird spaced headers in the CSV
  const stateHeader = headers.find(h => h.trim() === 'State') || '        State';
  const zipHeader = headers.find(h => h.trim() === 'Zip') || ' Zip';
  
  valuesMap[stateHeader] = state;
  valuesMap[zipHeader] = zip;
  valuesMap['State Tag'] = state;
  valuesMap['Phone'] = phone;
  valuesMap['Website'] = website;
  valuesMap['Company Email'] = email;
  valuesMap['Business Description'] = description;
  valuesMap['Lat'] = String(lat);
  valuesMap['Lon'] = String(lon);

  // Format columns in correct header order
  const finalCols = headers.map(h => escapeCSV(valuesMap[h] || ''));
  const newRowStr = '\n' + finalCols.join(',');

  console.log('💾 Appending to local CSV...');
  fs.appendFileSync(CSV_PATH, newRowStr, 'utf-8');
  console.log('✅ CSV Saved locally.');

  // HubSpot CRM Bridge
  const envPath = path.join(__dirname, '..', 'sales_automation', 'config', '.env');
  let hubToken = '';
  
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    const match = envFile.match(/HUBSPOT_ACCESS_TOKEN=(.+)/);
    if (match && match[1]) {
      hubToken = match[1].trim();
    }
  }

  if (hubToken) {
    console.log('\n🔗 SYNCING TO HUBSPOT CRM...');
    try {
      const hsResp = await fetch('https://api.hubapi.com/crm/v3/objects/companies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            name: company,
            address: street || '',
            city: city || '',
            state: state || '',
            zip: zip || '',
            phone: phone || '',
            website: website || '',
            description: `RadarPRO Desktop Added. ${description || ''}`.trim()
          }
        })
      });

      if (hsResp.ok) {
        const hsData = await hsResp.json();
        console.log(`✅ HubSpot Connected: Registered "${company}" in Sales CRM (ID: ${hsData.id})`);
      } else {
        const hsErr = await hsResp.text();
        console.log('⚠️ HubSpot sync failed:', hsErr);
      }
    } catch (hsErr) {
      console.log('⚠️ Could not reach HubSpot API:', hsErr.message);
    }
  }

  // Deploy changes!
  console.log('\n🚀 DEPLOYING TO RENDER CLOUD...');
  try {
    execSync('git add .', { cwd: __dirname, stdio: 'inherit' });
    execSync(`git commit -m "Added contact: ${company}"`, { cwd: __dirname, stdio: 'inherit' });
    
    // Get current branch
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: __dirname }).toString().trim();
    console.log(`📤 Pushing to branch: ${branch}...`);
    
    execSync(`git push origin ${branch}`, { cwd: __dirname, stdio: 'inherit' });
    
    console.log('\n=======================================================');
    console.log('🎉  SUCCESS! NEW PROSPECT ADDED AND DEPLOYED!');
    console.log('=======================================================');
    console.log(`\n🏢 ${company} is now in your database!`);
    console.log('⚡ Render will automatically rebuild and update your app');
    console.log('   within the next 2-3 minutes.\n');
  } catch (err) {
    console.error('\n⚠️ Git upload failed. Local file was updated, but cloud update failed.');
    console.error('Please double check internet connection or run the desktop DEPLOY.bat file.');
  }

  rl.close();
}

main().catch(console.error);
