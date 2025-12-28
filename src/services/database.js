/**
 * Cross-platform SQLite database abstraction
 * - Mobile: Uses expo-sqlite (native)
 * - Web/Electron: Uses sql.js (JavaScript SQLite with WebAssembly)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Database instances
let nativeDb = null;
let webDb = null;
let sqlJs = null;
let isInitialized = false;

// Storage key for persisting web database
const WEB_DB_STORAGE_KEY = 'fcpos_sqlite_db';

/**
 * Initialize the database based on platform
 */
export const initDatabase = async () => {
  if (isInitialized) return true;

  try {
    if (Platform.OS === 'web') {
      // Web/Electron: Use sql.js
      await initWebDatabase();
    } else {
      // Mobile: Use expo-sqlite
      await initNativeDatabase();
    }
    isInitialized = true;
    console.log(`[Database] Initialized for platform: ${Platform.OS}`);
    return true;
  } catch (error) {
    console.error('[Database] Initialization error:', error);
    return false;
  }
};

/**
 * Initialize native SQLite (expo-sqlite)
 */
const initNativeDatabase = async () => {
  const SQLite = require('expo-sqlite');
  nativeDb = await SQLite.openDatabaseAsync('pricelist.db');

  // Create tables
  await nativeDb.execAsync(`
    CREATE TABLE IF NOT EXISTS pricelist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_name TEXT,
      item_desc TEXT,
      barcode TEXT,
      item_number TEXT,
      currency_code TEXT,
      pricing_uom_code TEXT,
      tax_code TEXT,
      tax_rate TEXT,
      base_price TEXT,
      allow_discount TEXT,
      alcoholic_flag TEXT,
      inventory_item_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_list_name ON pricelist_items(list_name);
    CREATE INDEX IF NOT EXISTS idx_item_number ON pricelist_items(item_number);
    CREATE INDEX IF NOT EXISTS idx_barcode ON pricelist_items(barcode);

    CREATE TABLE IF NOT EXISTS bogo_promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_id INTEGER,
      promo_name TEXT,
      promo_number TEXT,
      promo_type TEXT,
      main_item_code TEXT,
      main_item_desc TEXT,
      promo_item_code TEXT,
      promo_item_desc TEXT,
      promo_price TEXT,
      buy_qty INTEGER,
      get_qty INTEGER,
      customer_number TEXT,
      is_discount_allowed TEXT,
      vat_code TEXT,
      start_date TEXT,
      end_date TEXT,
      allow_delete_flag TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_main_item_code ON bogo_promotions(main_item_code);
  `);

  console.log('[Database] Native SQLite initialized');
};

/**
 * Initialize web SQLite (sql.js)
 */
const initWebDatabase = async () => {
  try {
    // Dynamic import sql.js
    const initSqlJs = (await import('sql.js')).default;

    // Initialize sql.js with WASM
    sqlJs = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`
    });

    // Try to load existing database from storage
    const savedDb = await AsyncStorage.getItem(WEB_DB_STORAGE_KEY);
    if (savedDb) {
      const uint8Array = new Uint8Array(JSON.parse(savedDb));
      webDb = new sqlJs.Database(uint8Array);
      console.log('[Database] Loaded existing web database');
    } else {
      webDb = new sqlJs.Database();
      console.log('[Database] Created new web database');
    }

    // Create tables
    webDb.run(`
      CREATE TABLE IF NOT EXISTS pricelist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_name TEXT,
        item_desc TEXT,
        barcode TEXT,
        item_number TEXT,
        currency_code TEXT,
        pricing_uom_code TEXT,
        tax_code TEXT,
        tax_rate TEXT,
        base_price TEXT,
        allow_discount TEXT,
        alcoholic_flag TEXT,
        inventory_item_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_list_name ON pricelist_items(list_name);
      CREATE INDEX IF NOT EXISTS idx_item_number ON pricelist_items(item_number);
      CREATE INDEX IF NOT EXISTS idx_barcode ON pricelist_items(barcode);

      CREATE TABLE IF NOT EXISTS bogo_promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_id INTEGER,
        promo_name TEXT,
        promo_number TEXT,
        promo_type TEXT,
        main_item_code TEXT,
        main_item_desc TEXT,
        promo_item_code TEXT,
        promo_item_desc TEXT,
        promo_price TEXT,
        buy_qty INTEGER,
        get_qty INTEGER,
        customer_number TEXT,
        is_discount_allowed TEXT,
        vat_code TEXT,
        start_date TEXT,
        end_date TEXT,
        allow_delete_flag TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_main_item_code ON bogo_promotions(main_item_code);
    `);

    console.log('[Database] Web SQLite (sql.js) initialized');
  } catch (error) {
    console.error('[Database] Web database init error:', error);
    throw error;
  }
};

/**
 * Save web database to AsyncStorage
 */
const saveWebDatabase = async () => {
  if (Platform.OS !== 'web' || !webDb) return;

  try {
    const data = webDb.export();
    const arr = Array.from(data);
    await AsyncStorage.setItem(WEB_DB_STORAGE_KEY, JSON.stringify(arr));
    console.log('[Database] Web database saved to storage');
  } catch (error) {
    console.error('[Database] Error saving web database:', error);
  }
};

/**
 * Get database instance
 */
export const getDatabase = async () => {
  if (!isInitialized) {
    await initDatabase();
  }
  return Platform.OS === 'web' ? webDb : nativeDb;
};

/**
 * Execute a SQL query (no return value)
 */
export const runAsync = async (sql, params = []) => {
  const db = await getDatabase();
  if (!db) throw new Error('Database not initialized');

  if (Platform.OS === 'web') {
    db.run(sql, params);
    await saveWebDatabase();
  } else {
    await db.runAsync(sql, params);
  }
};

/**
 * Execute SQL and get all results
 */
export const getAllAsync = async (sql, params = []) => {
  const db = await getDatabase();
  if (!db) return [];

  if (Platform.OS === 'web') {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (error) {
      console.error('[Database] getAllAsync error:', error);
      return [];
    }
  } else {
    return await db.getAllAsync(sql, params);
  }
};

/**
 * Execute SQL and get first result
 */
export const getFirstAsync = async (sql, params = []) => {
  const db = await getDatabase();
  if (!db) return null;

  if (Platform.OS === 'web') {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
      }
      stmt.free();
      return null;
    } catch (error) {
      console.error('[Database] getFirstAsync error:', error);
      return null;
    }
  } else {
    return await db.getFirstAsync(sql, params);
  }
};

/**
 * Execute raw SQL (for CREATE TABLE, etc.)
 */
export const execAsync = async (sql) => {
  const db = await getDatabase();
  if (!db) throw new Error('Database not initialized');

  if (Platform.OS === 'web') {
    db.run(sql);
    await saveWebDatabase();
  } else {
    await db.execAsync(sql);
  }
};

/**
 * Check if database is available
 */
export const isDatabaseAvailable = () => {
  return isInitialized && (Platform.OS === 'web' ? webDb !== null : nativeDb !== null);
};

/**
 * Clear all data from a table
 */
export const clearTable = async (tableName) => {
  await runAsync(`DELETE FROM ${tableName}`);
};

export default {
  initDatabase,
  getDatabase,
  runAsync,
  getAllAsync,
  getFirstAsync,
  execAsync,
  isDatabaseAvailable,
  clearTable,
};
