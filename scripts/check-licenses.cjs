const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const lock = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8')
);
const packages = lock.packages || {};
const deniedLicenses = [];
const unknownLicenses = [];
let checked = 0;

function readManifest(location) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(projectRoot, location, 'package.json'), 'utf8')
    );
  } catch {
    return {};
  }
}

function normalizeLicense(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : entry?.type))
      .filter(Boolean)
      .join(' OR ');
  }
  return value?.type?.trim?.() || '';
}

for (const [location, metadata] of Object.entries(packages)) {
  if (!location || !location.includes('node_modules/') || metadata.dev === true) {
    continue;
  }

  const manifest = readManifest(location);
  const name = metadata.name || manifest.name || location.split('node_modules/').pop();
  const version = metadata.version || manifest.version || 'unknown';
  const license = normalizeLicense(metadata.license || manifest.license || manifest.licenses);
  checked += 1;

  if (!license) {
    unknownLicenses.push(`${name}@${version}`);
    continue;
  }

  const withoutLgpl = license.replace(
    /\bLGPL(?:-\d+(?:\.\d+)?)?(?:-only|-or-later)?\b/gi,
    ''
  );
  if (/\b(?:AGPL|GPL)(?:-\d+(?:\.\d+)?)?(?:-only|-or-later)?\b/i.test(withoutLgpl)) {
    deniedLicenses.push(`${name}@${version}: ${license}`);
  }
}

console.log(`Checked ${checked} production package entries.`);
if (unknownLicenses.length > 0) {
  console.warn(
    `${unknownLicenses.length} package entries do not declare a machine-readable license; review them in the generated SBOM.`
  );
}
if (deniedLicenses.length > 0) {
  console.error('Denied GPL/AGPL production licenses detected:');
  deniedLicenses.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}
console.log('Production license policy passed (no GPL/AGPL packages detected).');
