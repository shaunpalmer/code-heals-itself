#!/usr/bin/env node

/**
 * Schema Drift Guard
 *
 * Ensures only the canonical schemas exist and prevents drift.
 * Run this in CI to catch schema proliferation.
 */

const fs = require('fs');
const path = require('path');

const SCHEMAS_DIR = path.join(__dirname, '..', 'schemas');
const ALLOWED_SCHEMAS = [
  'patch-envelope.schema.json',
  'transmission.json'
];

const ALLOWED_ARCHIVE = [
  'transmission.v1.json'
];

function checkSchemas() {
  console.log('🔍 Checking schema drift...');

  // Check main schemas directory
  const schemas = fs.readdirSync(SCHEMAS_DIR)
    .filter(file => file.endsWith('.json'))
    .filter(file => !file.startsWith('.')); // Ignore hidden files

  const mainSchemas = schemas.filter(file => !fs.existsSync(path.join(SCHEMAS_DIR, 'archive', file)));
  const archiveSchemas = fs.readdirSync(path.join(SCHEMAS_DIR, 'archive'))
    .filter(file => file.endsWith('.json'));

  // Check for unexpected schemas
  const unexpectedMain = mainSchemas.filter(schema => !ALLOWED_SCHEMAS.includes(schema));
  if (unexpectedMain.length > 0) {
    console.error('❌ Unexpected schemas in main directory:', unexpectedMain);
    console.error('Only these are allowed:', ALLOWED_SCHEMAS);
    process.exit(1);
  }

  // Check archive
  const unexpectedArchive = archiveSchemas.filter(schema => !ALLOWED_ARCHIVE.includes(schema));
  if (unexpectedArchive.length > 0) {
    console.error('❌ Unexpected schemas in archive:', unexpectedArchive);
    console.error('Only these are allowed:', ALLOWED_ARCHIVE);
    process.exit(1);
  }

  // Check fixtures
  const fixturesDir = path.join(SCHEMAS_DIR, 'fixtures');
  if (fs.existsSync(fixturesDir)) {
    const fixtures = fs.readdirSync(fixturesDir)
      .filter(file => file.endsWith('.json'));

    if (fixtures.length === 0) {
      console.error('❌ No fixtures found in schemas/fixtures/');
      process.exit(1);
    }

    console.log(`✅ Found ${fixtures.length} fixture files`);
  }

  console.log('✅ Schema structure is clean!');
  console.log(`   Main schemas: ${mainSchemas.join(', ')}`);
  console.log(`   Archive: ${archiveSchemas.join(', ')}`);
}

if (require.main === module) {
  checkSchemas();
}

module.exports = { checkSchemas };