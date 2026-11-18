import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.PARK_DB_PATH || path.join(DATA_DIR, 'parkpulse.db');

function openCleanDatabase() {
  let conn = new DatabaseSync(DB_PATH);
  try {
    conn.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;');
    conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    return conn;
  } catch {
    try { conn.close(); } catch {}
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      try {
        fs.unlinkSync(`${DB_PATH}${suffix}`);
      } catch {}
    }
    conn = new DatabaseSync(DB_PATH);
    conn.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;');
    return conn;
  }
}

let db = openCleanDatabase();

const GREATER_NOIDA_LOTS = [
  { name: 'Pari Chowk Metro Transit Plaza', address: 'Pari Chowk Roundabout, Sector Omega II, Greater Noida', area: 'Pari Chowk', lot_type: 'transit', latitude: 28.4671, longitude: 77.5138, capacity: 240, price_per_hour: 30, supported_vehicles: 'both', opening_time: '05:00', closing_time: '23:30', is_24_hours: 0 },
  { name: 'The Grand Venice Mall Basement', address: 'Plot SH-3, Site IV, Near Pari Chowk, Greater Noida', area: 'Site IV', lot_type: 'mall', latitude: 28.4583, longitude: 77.5276, capacity: 300, price_per_hour: 50, supported_vehicles: 'both', opening_time: '10:00', closing_time: '23:00', is_24_hours: 0 },
  { name: 'Alpha 1 Commercial Belt Lot', address: 'Alpha 1 Commercial Market, Block C, Greater Noida', area: 'Alpha 1', lot_type: 'market', latitude: 28.4744, longitude: 77.5039, capacity: 120, price_per_hour: 20, supported_vehicles: 'both', opening_time: '07:00', closing_time: '22:30', is_24_hours: 0 },
  { name: 'Alpha 1 Metro Station Two-Wheeler Bay', address: 'Alpha 1 Metro Gate 2, Greater Noida', area: 'Alpha 1', lot_type: 'transit', latitude: 28.4768, longitude: 77.5064, capacity: 95, price_per_hour: 10, supported_vehicles: 'bike', opening_time: '05:30', closing_time: '23:00', is_24_hours: 0 },
  { name: 'Omaxe Connaught Place Parking', address: 'Beta 2, H Block, Omaxe CP, Greater Noida', area: 'Beta 2', lot_type: 'mall', latitude: 28.4819, longitude: 77.5158, capacity: 260, price_per_hour: 40, supported_vehicles: 'both', opening_time: '09:30', closing_time: '23:00', is_24_hours: 0 },
  { name: 'Jagat Farm Market Surface Lot', address: 'Jagat Farm Main Market, Gamma 1, Greater Noida', area: 'Gamma 1', lot_type: 'market', latitude: 28.4832, longitude: 77.5015, capacity: 85, price_per_hour: 20, supported_vehicles: 'both', opening_time: '08:00', closing_time: '22:00', is_24_hours: 0 },
  { name: 'India Expo Centre & Mart Gate 1', address: 'Plot 25-29, Knowledge Park II, Greater Noida', area: 'Knowledge Park II', lot_type: 'office', latitude: 28.4622, longitude: 77.4956, capacity: 280, price_per_hour: 60, supported_vehicles: 'car', opening_time: '00:00', closing_time: '24:00', is_24_hours: 1 },
  { name: 'Knowledge Park II Metro Commuter Lot', address: 'Knowledge Park II Metro Station, Greater Noida', area: 'Knowledge Park II', lot_type: 'transit', latitude: 28.4601, longitude: 77.4999, capacity: 150, price_per_hour: 20, supported_vehicles: 'both', opening_time: '00:00', closing_time: '24:00', is_24_hours: 1 },
  { name: 'Stellar IT Park Multi-Level Car Deck', address: 'Plot 12, Knowledge Park III, Greater Noida', area: 'Knowledge Park III', lot_type: 'office', latitude: 28.4721, longitude: 77.4841, capacity: 210, price_per_hour: 45, supported_vehicles: 'car', opening_time: '06:30', closing_time: '22:00', is_24_hours: 0 },
  { name: 'Sharda Campus Academic Gate Bay', address: 'Plot 32-34, Knowledge Park III, Greater Noida', area: 'Knowledge Park III', lot_type: 'campus', latitude: 28.4737, longitude: 77.4822, capacity: 140, price_per_hour: 15, supported_vehicles: 'both', opening_time: '07:00', closing_time: '20:30', is_24_hours: 0 },
  { name: 'Ansal Plaza Mall Forecourt', address: 'Site IV, Pari Chowk Extension, Greater Noida', area: 'Pari Chowk', lot_type: 'mall', latitude: 28.4639, longitude: 77.5194, capacity: 190, price_per_hour: 35, supported_vehicles: 'both', opening_time: '10:00', closing_time: '22:30', is_24_hours: 0 },
  { name: 'Beta 1 Sector Shopping Square', address: 'Beta 1 Main Market Road, Greater Noida', area: 'Beta 1', lot_type: 'market', latitude: 28.4779, longitude: 77.5117, capacity: 65, price_per_hour: 15, supported_vehicles: 'both', opening_time: '08:00', closing_time: '22:00', is_24_hours: 0 },
  { name: 'Alpha 2 Commercial Hub Lot', address: 'Alpha 2 Sector Market, Near Gol Chakkar, Greater Noida', area: 'Alpha 2', lot_type: 'market', latitude: 28.4728, longitude: 77.5162, capacity: 90, price_per_hour: 25, supported_vehicles: 'both', opening_time: '07:30', closing_time: '22:00', is_24_hours: 0 },
  { name: 'Delta 1 Metro Park & Ride', address: 'Delta 1 Metro Station, Surajpur-Kasna Road, Greater Noida', area: 'Delta 1', lot_type: 'transit', latitude: 28.4867, longitude: 77.5236, capacity: 160, price_per_hour: 20, supported_vehicles: 'both', opening_time: '00:00', closing_time: '24:00', is_24_hours: 1 },
  { name: 'Surajpur District Complex Visitor Lot', address: 'Collectorate Road, Surajpur, Greater Noida', area: 'Surajpur', lot_type: 'office', latitude: 28.5082, longitude: 77.4889, capacity: 130, price_per_hour: 20, supported_vehicles: 'both', opening_time: '08:00', closing_time: '19:30', is_24_hours: 0 },
  { name: 'Galgotias Innovation Hub Bike Stand', address: 'Knowledge Park II North Wing, Greater Noida', area: 'Knowledge Park II', lot_type: 'campus', latitude: 28.4659, longitude: 77.4927, capacity: 70, price_per_hour: 10, supported_vehicles: 'bike', opening_time: '07:30', closing_time: '20:00', is_24_hours: 0 },
  { name: 'MSX Mall Commercial Plaza', address: 'Swarn Nagari, Sector Alpha II Road, Greater Noida', area: 'Swarn Nagari', lot_type: 'mall', latitude: 28.4685, longitude: 77.5284, capacity: 175, price_per_hour: 40, supported_vehicles: 'car', opening_time: '09:30', closing_time: '23:00', is_24_hours: 0 },
  { name: 'Jaypee Greens Sector Pi Plaza', address: 'Sector Pi-1, Near Eldeco Green Meadows, Greater Noida', area: 'Sector Pi', lot_type: 'market', latitude: 28.4596, longitude: 77.5372, capacity: 45, price_per_hour: 30, supported_vehicles: 'both', opening_time: '00:00', closing_time: '24:00', is_24_hours: 1 },
];

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS parking_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL,
      area TEXT NOT NULL,
      lot_type TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      capacity INTEGER NOT NULL,
      price_per_hour REAL NOT NULL,
      supported_vehicles TEXT NOT NULL,
      opening_time TEXT NOT NULL,
      closing_time TEXT NOT NULL,
      is_24_hours INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS occupancy_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      occupied_slots INTEGER,
      capacity_snapshot INTEGER NOT NULL,
      occupancy_rate REAL,
      source_type TEXT NOT NULL,
      is_processed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_occ_lot_ts_src ON occupancy_records(lot_id, timestamp, source_type);
    CREATE TABLE IF NOT EXISTS historical_occupancy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      occupied_slots INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      occupancy_rate REAL NOT NULL,
      hour INTEGER NOT NULL,
      minute_bin INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      is_weekend INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(lot_id, timestamp, source_type)
    );
    CREATE INDEX IF NOT EXISTS ix_hist_lot_dow_hour ON historical_occupancy(lot_id, day_of_week, hour, minute_bin);
    CREATE TABLE IF NOT EXISTS searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      destination TEXT NOT NULL,
      destination_lat REAL,
      destination_lng REAL,
      arrival_time TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      max_walking_distance_m INTEGER NOT NULL,
      preference TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
      target_timestamp TEXT NOT NULL,
      predicted_occupied_slots INTEGER NOT NULL,
      predicted_free_slots INTEGER NOT NULL,
      lower_bound_slots INTEGER,
      upper_bound_slots INTEGER,
      confidence REAL,
      source_type TEXT NOT NULL,
      model_version TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS parking_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
      search_id INTEGER REFERENCES searches(id) ON DELETE SET NULL,
      action_type TEXT NOT NULL,
      vehicle_type TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
      vehicle_type TEXT NOT NULL,
      checkin_time TEXT NOT NULL,
      checkout_time TEXT,
      duration_minutes INTEGER,
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS model_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_name TEXT NOT NULL,
      mae REAL NOT NULL,
      rmse REAL NOT NULL,
      baseline_mae REAL,
      baseline_rmse REAL,
      dataset_source TEXT NOT NULL DEFAULT 'simulated',
      sample_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      trained_at TEXT NOT NULL
    );
  `);
}

function gaussian(hours, center, width, amplitude) {
  return amplitude * Math.exp(-0.5 * ((hours - center) / width) ** 2);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalNoise(rand, std = 0.045) {
  const u1 = Math.max(1e-7, rand());
  const u2 = rand();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * std;
}

function toIsoNoMs(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function runPipeline(reprocessAll = false) {
  const lots = db.prepare('SELECT id, capacity FROM parking_lots').all();
  const capMap = new Map(lots.map((l) => [l.id, l.capacity]));
  const rawRows = reprocessAll
    ? db.prepare('SELECT * FROM occupancy_records ORDER BY lot_id, timestamp, id').all()
    : db.prepare('SELECT * FROM occupancy_records WHERE is_processed = 0 ORDER BY lot_id, timestamp, id').all();

  const rawCount = rawRows.length;
  const validSources = new Set(['simulated', 'live', 'feedback', 'historical']);
  const nowStr = toIsoNoMs(new Date());

  if (rawCount === 0) {
    const totalHist = db.prepare('SELECT COUNT(*) AS cnt FROM historical_occupancy').get().cnt;
    const sources = db.prepare('SELECT DISTINCT source_type FROM historical_occupancy').all().map((r) => r.source_type);
    return {
      status: 'no_new_records',
      raw_records_read: 0,
      invalid_dropped: 0,
      duplicates_removed: 0,
      missing_imputed: 0,
      records_normalised_stored: 0,
      total_historical_rows: totalHist,
      source_types: sources.sort(),
      executed_at: new Date().toISOString(),
    };
  }

  let invalidDropped = 0;
  const deduped = new Map();
  let beforeDedup = 0;

  for (const row of rawRows) {
    const cap = capMap.get(row.lot_id) ?? row.capacity_snapshot;
    const dt = new Date(String(row.timestamp).replace(' ', 'T') + 'Z');
    const valid =
      capMap.has(row.lot_id) &&
      !Number.isNaN(dt.getTime()) &&
      validSources.has(row.source_type) &&
      cap > 0 &&
      (row.occupied_slots === null || row.occupied_slots >= 0);

    if (!valid) {
      invalidDropped += 1;
      continue;
    }

    dt.setUTCMinutes(Math.floor(dt.getUTCMinutes() / 15) * 15, 0, 0);
    const flooredTs = toIsoNoMs(dt);
    const key = `${row.lot_id}|${flooredTs}|${row.source_type}`;
    beforeDedup += 1;
    deduped.set(key, {
      lot_id: row.lot_id,
      timestamp: flooredTs,
      dt,
      occupied_slots: row.occupied_slots,
      capacity: cap,
      source_type: row.source_type,
    });
  }

  const rows = Array.from(deduped.values());
  const duplicatesRemoved = beforeDedup - rows.length;
  let missingImputed = 0;

  // Group by lot_id for simple linear interpolation of missing occupied_slots
  const byLot = new Map();
  for (const item of rows) {
    if (!byLot.has(item.lot_id)) byLot.set(item.lot_id, []);
    byLot.get(item.lot_id).push(item);
  }
  for (const list of byLot.values()) {
    list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (let i = 0; i < list.length; i++) {
      if (list[i].occupied_slots === null || list[i].occupied_slots === undefined) {
        missingImputed += 1;
        const prev = i > 0 ? list[i - 1].occupied_slots : null;
        let next = null;
        for (let j = i + 1; j < list.length; j++) {
          if (list[j].occupied_slots !== null && list[j].occupied_slots !== undefined) {
            next = list[j].occupied_slots;
            break;
          }
        }
        if (prev !== null && next !== null) list[i].occupied_slots = Math.round((prev + next) / 2);
        else if (prev !== null) list[i].occupied_slots = prev;
        else if (next !== null) list[i].occupied_slots = next;
        else list[i].occupied_slots = Math.round(list[i].capacity * 0.5);
      }
    }
  }

  const upsertHist = db.prepare(`
    INSERT INTO historical_occupancy
      (lot_id, timestamp, occupied_slots, capacity, occupancy_rate, hour, minute_bin, day_of_week, is_weekend, source_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lot_id, timestamp, source_type) DO UPDATE SET
      occupied_slots = excluded.occupied_slots,
      capacity = excluded.capacity,
      occupancy_rate = excluded.occupancy_rate,
      hour = excluded.hour,
      minute_bin = excluded.minute_bin,
      day_of_week = excluded.day_of_week,
      is_weekend = excluded.is_weekend
  `);
  const markProcessed = db.prepare('UPDATE occupancy_records SET is_processed = 1 WHERE id = ?');

  db.exec('BEGIN');
  try {
    for (const item of rows) {
      const occ = Math.max(0, Math.min(item.capacity, Math.round(Number(item.occupied_slots))));
      const rate = Number((occ / item.capacity).toFixed(4));
      const hour = item.dt.getUTCHours();
      const minuteBin = Math.floor(item.dt.getUTCMinutes() / 15) * 15;
      const pyDow = (item.dt.getUTCDay() + 6) % 7; // 0=Mon..6=Sun
      const isWeekend = pyDow >= 5 ? 1 : 0;
      upsertHist.run(
        item.lot_id,
        item.timestamp,
        occ,
        item.capacity,
        rate,
        hour,
        minuteBin,
        pyDow,
        isWeekend,
        item.source_type,
        nowStr,
      );
    }
    for (const r of rawRows) {
      markProcessed.run(r.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const totalHist = db.prepare('SELECT COUNT(*) AS cnt FROM historical_occupancy').get().cnt;
  const sources = db.prepare('SELECT DISTINCT source_type FROM historical_occupancy').all().map((r) => r.source_type);

  return {
    status: 'completed',
    raw_records_read: rawCount,
    invalid_dropped: invalidDropped,
    duplicates_removed: duplicatesRemoved,
    missing_imputed: missingImputed,
    records_normalised_stored: rows.length,
    total_historical_rows: totalHist,
    source_types: sources.sort(),
    executed_at: new Date().toISOString(),
  };
}

function seedIfNeeded(force = false) {
  const existingLots = db.prepare('SELECT COUNT(*) AS cnt FROM parking_lots').get().cnt;
  if (existingLots > 0 && !force) {
    const histCount = db.prepare('SELECT COUNT(*) AS cnt FROM historical_occupancy').get().cnt;
    if (histCount > 0) return { seeded: false, lots_count: existingLots };
    const rawCount = db.prepare('SELECT COUNT(*) AS cnt FROM occupancy_records').get().cnt;
    if (rawCount > 0) {
      return { seeded: false, recovered_pipeline: true, pipeline_result: runPipeline(true) };
    }
    force = true;
  }

  if (force) {
    db.exec('DELETE FROM historical_occupancy; DELETE FROM occupancy_records; DELETE FROM parking_lots;');
  }

  const now = new Date();
  const nowStr = toIsoNoMs(now);
  const insertLot = db.prepare(`
    INSERT INTO parking_lots
      (name, address, area, lot_type, latitude, longitude, capacity, price_per_hour, supported_vehicles, opening_time, closing_time, is_24_hours, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const lots = [];
  db.exec('BEGIN');
  try {
    for (const lot of GREATER_NOIDA_LOTS) {
      const info = insertLot.run(
        lot.name,
        lot.address,
        lot.area,
        lot.lot_type,
        lot.latitude,
        lot.longitude,
        lot.capacity,
        lot.price_per_hour,
        lot.supported_vehicles,
        lot.opening_time,
        lot.closing_time,
        lot.is_24_hours,
        nowStr,
      );
      lots.push({ id: Number(info.lastInsertRowid), ...lot });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const endMs = Math.floor(now.getTime() / (15 * 60 * 1000)) * 15 * 60 * 1000;
  const startMs = endMs - 42 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000;
  const rand = mulberry32(42);
  const insertRaw = db.prepare(`
    INSERT INTO occupancy_records
      (lot_id, timestamp, occupied_slots, capacity_snapshot, occupancy_rate, source_type, is_processed, created_at)
    VALUES (?, ?, ?, ?, ?, 'simulated', 0, ?)
  `);

  db.exec('BEGIN');
  let rawCount = 0;
  try {
    for (const lot of lots) {
      const openParts = lot.opening_time.split(':').map(Number);
      const closeParts = lot.closing_time.split(':').map(Number);
      const openH = openParts[0] + openParts[1] / 60;
      const closeH = closeParts[0] + closeParts[1] / 60;

      for (let tsMs = startMs, idx = 0; tsMs <= endMs; tsMs += 15 * 60 * 1000, idx++) {
        const dt = new Date(tsMs);
        const h = dt.getUTCHours() + dt.getUTCMinutes() / 60;
        const dow = (dt.getUTCDay() + 6) % 7;
        const isWeekend = dow >= 5 ? 1 : 0;
        const isWeekday = 1 - isWeekend;

        let rate = 0.14;
        if (lot.lot_type === 'office') {
          rate += isWeekday * (gaussian(h, 11.2, 2.2, 0.56) + gaussian(h, 15.5, 2.5, 0.52)) + isWeekend * gaussian(h, 14.0, 3.0, 0.14);
        } else if (lot.lot_type === 'mall') {
          rate += isWeekday * (gaussian(h, 14.0, 2.2, 0.30) + gaussian(h, 19.5, 2.0, 0.52)) + isWeekend * (gaussian(h, 14.5, 2.5, 0.52) + gaussian(h, 19.8, 2.2, 0.68));
        } else if (lot.lot_type === 'market') {
          rate += isWeekday * (gaussian(h, 11.5, 1.8, 0.42) + gaussian(h, 18.8, 1.9, 0.60)) + isWeekend * (gaussian(h, 12.0, 2.0, 0.54) + gaussian(h, 19.0, 2.0, 0.66));
        } else if (lot.lot_type === 'transit') {
          rate = 0.16 + isWeekday * (gaussian(h, 9.2, 1.6, 0.65) + gaussian(h, 14.0, 3.0, 0.50) + gaussian(h, 18.5, 1.7, 0.58)) + isWeekend * gaussian(h, 13.5, 3.5, 0.35);
        } else {
          const isSat = dow === 5 ? 1 : 0;
          rate = 0.08 + isWeekday * (gaussian(h, 10.5, 2.1, 0.62) + gaussian(h, 14.5, 2.0, 0.48)) + isSat * gaussian(h, 11.5, 2.5, 0.30);
        }

        rate = Math.max(0.03, Math.min(0.98, rate + normalNoise(rand, 0.045)));
        if (!lot.is_24_hours && (h < openH || h > closeH)) {
          rate = Math.max(0.0, Math.min(0.08, 0.03 + normalNoise(rand, 0.015)));
        }

        const occ = Math.round(rate * lot.capacity);
        const isMissing = idx % 503 === 0 && lot.id % 3 === 0;
        insertRaw.run(
          lot.id,
          toIsoNoMs(dt),
          isMissing ? null : occ,
          lot.capacity,
          isMissing ? null : Number((occ / lot.capacity).toFixed(4)),
          nowStr,
        );
        rawCount += 1;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const pipelineResult = runPipeline(false);
  return {
    seeded: true,
    lots_count: lots.length,
    raw_simulated_records_created: rawCount,
    pipeline_result: pipelineResult,
  };
}

try {
  createSchema();
  seedIfNeeded(false);
} catch (err) {
  try { db.close(); } catch {}
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (f.startsWith('parkpulse.db')) {
      fs.rmSync(path.join(DATA_DIR, f), { force: true });
    }
  }
  db = openCleanDatabase();
  createSchema();
  seedIfNeeded(true);
}

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  const lotsCount = db.prepare('SELECT COUNT(*) AS cnt FROM parking_lots').get().cnt;
  const histCount = db.prepare('SELECT COUNT(*) AS cnt FROM historical_occupancy').get().cnt;
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
  res.json({
    status: 'ok',
    database_engine: 'sqlite',
    runtime_mode: 'cloudrun-node-fallback',
    tables,
    parking_lots_count: lotsCount,
    historical_occupancy_count: histCount,
  });
});

app.get('/api/lots', (req, res) => {
  const conditions = [];
  const params = [];
  const area = typeof req.query.area === 'string' ? req.query.area.trim() : '';
  const lotType = typeof req.query.lot_type === 'string' ? req.query.lot_type.trim().toLowerCase() : '';
  const vehicleType = typeof req.query.vehicle_type === 'string' ? req.query.vehicle_type.trim().toLowerCase() : '';

  if (area) {
    conditions.push('LOWER(p.area) LIKE ?');
    params.push(`%${area.toLowerCase()}%`);
  }
  if (lotType && lotType !== 'all') {
    conditions.push('p.lot_type = ?');
    params.push(lotType);
  }
  if (vehicleType === 'car' || vehicleType === 'bike') {
    conditions.push("p.supported_vehicles IN (?, 'both')");
    params.push(vehicleType);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const lots = db.prepare(`SELECT * FROM parking_lots p ${whereClause} ORDER BY p.id ASC`).all(...params);
  const latestStmt = db.prepare(
    'SELECT * FROM historical_occupancy WHERE lot_id = ? ORDER BY timestamp DESC LIMIT 1',
  );

  const response = lots.map((lot) => {
    const latest = latestStmt.get(lot.id);
    return {
      id: lot.id,
      name: lot.name,
      address: lot.address,
      area: lot.area,
      lot_type: lot.lot_type,
      latitude: lot.latitude,
      longitude: lot.longitude,
      capacity: lot.capacity,
      price_per_hour: lot.price_per_hour,
      supported_vehicles: lot.supported_vehicles,
      opening_time: lot.opening_time,
      closing_time: lot.closing_time,
      is_24_hours: Boolean(lot.is_24_hours),
      latest_occupied_slots: latest ? latest.occupied_slots : null,
      latest_free_slots: latest ? Math.max(0, lot.capacity - latest.occupied_slots) : null,
      latest_occupancy_rate: latest ? latest.occupancy_rate : null,
      availability_source: latest ? 'Baseline' : 'Unknown',
      data_label: latest ? (latest.source_type === 'simulated' ? 'Simulated data' : latest.source_type) : 'No occupancy data',
      latest_timestamp: latest ? latest.timestamp.replace(' ', 'T') : null,
    };
  });

  res.json(response);
});

app.get('/api/lots/:lotId', (req, res) => {
  const lotId = Number(req.params.lotId);
  const lot = db.prepare('SELECT * FROM parking_lots WHERE id = ?').get(lotId);
  if (!lot) {
    return res.status(404).json({ detail: 'Parking lot not found.' });
  }
  const history = db
    .prepare('SELECT * FROM historical_occupancy WHERE lot_id = ? ORDER BY timestamp DESC LIMIT 96')
    .all(lotId)
    .reverse();

  res.json({
    lot: {
      id: lot.id,
      name: lot.name,
      address: lot.address,
      area: lot.area,
      lot_type: lot.lot_type,
      latitude: lot.latitude,
      longitude: lot.longitude,
      capacity: lot.capacity,
      price_per_hour: lot.price_per_hour,
      supported_vehicles: lot.supported_vehicles,
      opening_time: lot.opening_time,
      closing_time: lot.closing_time,
      is_24_hours: Boolean(lot.is_24_hours),
    },
    availability_source: history.length ? 'Baseline' : 'Unknown',
    data_label: 'Simulated data',
    recent_24h: history.map((h) => ({
      timestamp: h.timestamp.replace(' ', 'T'),
      occupied_slots: h.occupied_slots,
      free_slots: Math.max(0, lot.capacity - h.occupied_slots),
      occupancy_rate: h.occupancy_rate,
      source_type: h.source_type,
    })),
  });
});

app.post('/api/searches', (req, res) => {
  const body = req.body ?? {};
  const errors = [];
  const dest = typeof body.destination === 'string' ? body.destination.trim() : '';

  if (dest.length < 3) {
    errors.push({ field: 'destination', message: 'Destination must be at least 3 characters long.' });
  } else if (/^\d+$/.test(dest)) {
    errors.push({ field: 'destination', message: 'Please enter a valid street, sector, or landmark in Greater Noida.' });
  }

  const arrivalDate = typeof body.arrival_date === 'string' ? body.arrival_date : '';
  const arrivalTime = typeof body.arrival_time === 'string' ? body.arrival_time : '';
  const dt = new Date(`${arrivalDate}T${arrivalTime}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) || !/^\d{2}:\d{2}$/.test(arrivalTime) || Number.isNaN(dt.getTime())) {
    errors.push({ field: 'arrival_date', message: 'Invalid arrival date or time.' });
  } else if (dt.getTime() < Date.now() - 15 * 60 * 1000) {
    errors.push({ field: 'arrival_time', message: 'Arrival date and time cannot be in the past.' });
  } else if (dt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
    errors.push({ field: 'arrival_date', message: 'Arrival date cannot be more than 30 days ahead.' });
  }

  const dur = Number(body.duration_minutes);
  if (!Number.isInteger(dur) || dur < 15 || dur > 1440) {
    errors.push({ field: 'duration_minutes', message: 'Duration must be between 15 and 1440 minutes.' });
  }

  const walk = Number(body.max_walking_distance_m);
  if (!Number.isInteger(walk) || walk < 100 || walk > 5000) {
    errors.push({ field: 'max_walking_distance_m', message: 'Walking distance must be between 100 and 5000 meters.' });
  }

  if (!['car', 'bike'].includes(body.vehicle_type)) {
    errors.push({ field: 'vehicle_type', message: 'Vehicle type must be car or bike.' });
  }
  if (!['best_match', 'cheapest', 'nearest', 'best_availability'].includes(body.preference)) {
    errors.push({ field: 'preference', message: 'Invalid preference.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({ detail: 'Please fix the highlighted search inputs.', errors });
  }

  const arrivalIso = `${arrivalDate} ${arrivalTime}:00`;
  const createdAt = toIsoNoMs(new Date());
  const info = db
    .prepare(
      `INSERT INTO searches (user_id, destination, destination_lat, destination_lng, arrival_time, vehicle_type, duration_minutes, max_walking_distance_m, preference, created_at)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      dest,
      body.destination_lat ?? null,
      body.destination_lng ?? null,
      arrivalIso,
      body.vehicle_type,
      dur,
      walk,
      body.preference,
      createdAt,
    );

  const saved = db.prepare('SELECT * FROM searches WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({
    ...saved,
    arrival_time: saved.arrival_time.replace(' ', 'T'),
    created_at: saved.created_at.replace(' ', 'T'),
  });
});

app.get('/api/searches', (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const rows = db.prepare('SELECT * FROM searches ORDER BY created_at DESC, id DESC LIMIT ?').all(limit);
  res.json(
    rows.map((r) => ({
      ...r,
      arrival_time: r.arrival_time.replace(' ', 'T'),
      created_at: r.created_at.replace(' ', 'T'),
    })),
  );
});

app.post('/api/pipeline/run', (req, res) => {
  const reprocessAll = req.query.reprocess_all === 'true';
  res.json(runPipeline(reprocessAll));
});

app.get('/api/pipeline/status', (_req, res) => {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
  const totalLots = db.prepare('SELECT COUNT(*) AS cnt FROM parking_lots').get().cnt;
  const totalRaw = db.prepare('SELECT COUNT(*) AS cnt FROM occupancy_records').get().cnt;
  const unprocessed = db.prepare('SELECT COUNT(*) AS cnt FROM occupancy_records WHERE is_processed = 0').get().cnt;
  const totalHist = db.prepare('SELECT COUNT(*) AS cnt FROM historical_occupancy').get().cnt;
  const simCount = db.prepare("SELECT COUNT(*) AS cnt FROM historical_occupancy WHERE source_type = 'simulated'").get().cnt;
  const liveCount = db.prepare("SELECT COUNT(*) AS cnt FROM historical_occupancy WHERE source_type = 'live'").get().cnt;
  const bounds = db.prepare('SELECT MIN(timestamp) AS min_ts, MAX(timestamp) AS max_ts FROM historical_occupancy').get();

  res.json({
    database_engine: 'sqlite',
    total_lots: totalLots,
    total_raw_occupancy_records: totalRaw,
    unprocessed_occupancy_records: unprocessed,
    total_historical_records: totalHist,
    simulated_records: simCount,
    live_records: liveCount,
    earliest_timestamp: bounds.min_ts ? bounds.min_ts.replace(' ', 'T') : null,
    latest_timestamp: bounds.max_ts ? bounds.max_ts.replace(' ', 'T') : null,
    tables,
  });
});

app.post('/api/seed', (req, res) => {
  const force = req.query.force === 'true';
  res.json(seedIfNeeded(force));
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ detail: 'API route not found' });
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ParkPulse production server listening on port ${PORT}`);
});
