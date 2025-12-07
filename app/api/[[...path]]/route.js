import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DB_PATH = path.join(process.cwd(), 'inventory.db');

let db = null;

function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, passwordHash TEXT NOT NULL, role TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL, contactEmail TEXT, contactPhone TEXT, createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS inventoryItems (id TEXT PRIMARY KEY, sku TEXT NOT NULL, productName TEXT NOT NULL, currentQuantity INTEGER NOT NULL, reorderLevel INTEGER NOT NULL, unitCost REAL NOT NULL DEFAULT 0, storeId TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, FOREIGN KEY (storeId) REFERENCES stores(id), UNIQUE(sku, storeId));
      CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, itemId TEXT NOT NULL, storeId TEXT NOT NULL, sku TEXT NOT NULL, productName TEXT NOT NULL, currentQuantity INTEGER NOT NULL, reorderLevel INTEGER NOT NULL, alertType TEXT NOT NULL, triggered TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, resolvedBy TEXT, resolvedAt TEXT, FOREIGN KEY (itemId) REFERENCES inventoryItems(id));
      CREATE TABLE IF NOT EXISTS inventoryHistory (id TEXT PRIMARY KEY, itemId TEXT NOT NULL, changeType TEXT NOT NULL, quantityChange INTEGER NOT NULL, previousQty INTEGER NOT NULL, newQty INTEGER NOT NULL, userId TEXT, notes TEXT, timestamp TEXT NOT NULL, FOREIGN KEY (itemId) REFERENCES inventoryItems(id));
    `);
  }
  return db;
}

function verifyToken(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function checkAndCreateAlerts(itemId) {
  const db = getDatabase();
  const item = db.prepare('SELECT * FROM inventoryItems WHERE id = ?').get(itemId);
  if (!item) return;
  const shouldAlert = item.currentQuantity <= item.reorderLevel;
  const existingAlert = db.prepare('SELECT * FROM alerts WHERE itemId = ? AND resolved = 0').get(itemId);
  if (shouldAlert && !existingAlert) {
    db.prepare(`INSERT INTO alerts (id, itemId, storeId, sku, productName, currentQuantity, reorderLevel, alertType, triggered, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, 'reorder', ?, 0)`).run(uuidv4(), item.id, item.storeId, item.sku, item.productName, item.currentQuantity, item.reorderLevel, new Date().toISOString());
  } else if (!shouldAlert && existingAlert) {
    db.prepare(`UPDATE alerts SET resolved = 1, resolvedAt = ?, resolvedBy = 'system' WHERE id = ?`).run(new Date().toISOString(), existingAlert.id);
  }
}

export async function GET(request) {
  try {
    const db = getDatabase();
    const { pathname, searchParams } = new URL(request.url);
    const path = pathname.replace('/api', '') || '/';
    if (path === '/') return NextResponse.json({ message: 'Store Inventory Tracker API' });
    const user = verifyToken(request);
    if (!user && !path.startsWith('/auth/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (path === '/auth/me') return NextResponse.json({ user: db.prepare('SELECT id, username, role, createdAt FROM users WHERE id = ?').get(user.userId) });
    if (path === '/stores') return NextResponse.json({ stores: db.prepare('SELECT * FROM stores').all() });
    if (path === '/inventory') {
      let query = 'SELECT * FROM inventoryItems WHERE 1=1', params = [];
      if (searchParams.get('storeId')) { query += ' AND storeId = ?'; params.push(searchParams.get('storeId')); }
      if (searchParams.get('search')) { query += ' AND (sku LIKE ? OR productName LIKE ?)'; params.push(`%${searchParams.get('search')}%`, `%${searchParams.get('search')}%`); }
      let items = db.prepare(query).all(...params);
      if (searchParams.get('lowStock') === 'true') items = items.filter(item => item.currentQuantity <= item.reorderLevel);
      const storeMap = Object.fromEntries(db.prepare('SELECT id, name FROM stores').all().map(s => [s.id, s.name]));
      return NextResponse.json({ items: items.map(item => ({ ...item, storeName: storeMap[item.storeId] || 'Unknown' })) });
    }
    if (path === '/alerts') {
      let query = 'SELECT * FROM alerts';
      if (searchParams.get('resolved') === 'false') query += ' WHERE resolved = 0';
      query += ' ORDER BY triggered DESC';
      const alerts = db.prepare(query).all();
      const storeMap = Object.fromEntries(db.prepare('SELECT id, name FROM stores').all().map(s => [s.id, s.name]));
      return NextResponse.json({ alerts: alerts.map(alert => ({ ...alert, resolved: Boolean(alert.resolved), storeName: storeMap[alert.storeId] || 'Unknown' })) });
    }
    if (path === '/dashboard/stats') {
      const items = db.prepare('SELECT currentQuantity, unitCost, reorderLevel FROM inventoryItems').all();
      return NextResponse.json({
        stats: {
          totalItems: db.prepare('SELECT COUNT(*) as count FROM inventoryItems').get().count,
          totalStores: db.prepare('SELECT COUNT(*) as count FROM stores').get().count,
          activeAlerts: db.prepare('SELECT COUNT(*) as count FROM alerts WHERE resolved = 0').get().count,
          totalValue: items.reduce((sum, item) => sum + (item.currentQuantity * item.unitCost), 0).toFixed(2),
          lowStockCount: items.filter(item => item.currentQuantity <= item.reorderLevel).length
        }
      });
    }
    if (path.startsWith('/inventory/') && path.endsWith('/history')) {
      const itemId = path.split('/')[2];
      const history = db.prepare('SELECT * FROM inventoryHistory WHERE itemId = ? ORDER BY timestamp DESC LIMIT 50').all(itemId);
      const userIds = [...new Set(history.map(h => h.userId).filter(Boolean))];
      const userMap = userIds.length > 0 ? Object.fromEntries(db.prepare(`SELECT id, username FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`).all(...userIds).map(u => [u.id, u.username])) : {};
      return NextResponse.json({ history: history.map(h => ({ ...h, username: userMap[h.userId] || 'System' })) });
    }
    if (path === '/inventory/export') {
      const items = db.prepare('SELECT * FROM inventoryItems').all();
      const storeMap = Object.fromEntries(db.prepare('SELECT id, name FROM stores').all().map(s => [s.id, s.name]));
      const csvData = items.map(item => ({ SKU: item.sku, 'Product Name': item.productName, 'Store': storeMap[item.storeId] || '', 'Current Quantity': item.currentQuantity, 'Reorder Level': item.reorderLevel, 'Unit Cost': item.unitCost, 'Total Value': (item.currentQuantity * item.unitCost).toFixed(2), 'Needs Reorder': item.currentQuantity <= item.reorderLevel ? 'Yes' : 'No' }));
      return new NextResponse(Papa.unparse(csvData), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="inventory-export-${new Date().toISOString().split('T')[0]}.csv"` } });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = getDatabase();
    const { pathname } = new URL(request.url);
    const path = pathname.replace('/api', '') || '/';
    const body = await request.json();
    if (path === '/auth/register') {
      const { username, password, role } = body;
      if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
      if (db.prepare('SELECT * FROM users WHERE username = ?').get(username)) return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = { id: uuidv4(), username, passwordHash, role: role || 'staff', createdAt: new Date().toISOString() };
      db.prepare('INSERT INTO users (id, username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)').run(newUser.id, newUser.username, newUser.passwordHash, newUser.role, newUser.createdAt);
      const token = jwt.sign({ userId: newUser.id, username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
      return NextResponse.json({ message: 'User registered successfully', token, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
    }
    if (path === '/auth/login') {
      const { username, password } = body;
      if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return NextResponse.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, role: user.role } });
    }
    const user = verifyToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (path === '/stores') {
      const { name, location, contactEmail, contactPhone } = body;
      if (!name || !location) return NextResponse.json({ error: 'Name and location required' }, { status: 400 });
      const newStore = { id: uuidv4(), name, location, contactEmail: contactEmail || '', contactPhone: contactPhone || '', createdAt: new Date().toISOString() };
      db.prepare('INSERT INTO stores (id, name, location, contactEmail, contactPhone, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(newStore.id, newStore.name, newStore.location, newStore.contactEmail, newStore.contactPhone, newStore.createdAt);
      return NextResponse.json({ message: 'Store created successfully', store: newStore });
    }
    if (path === '/inventory') {
      const { sku, productName, currentQuantity, reorderLevel, unitCost, storeId } = body;
      if (!sku || !productName || currentQuantity === undefined || reorderLevel === undefined || !storeId) return NextResponse.json({ error: 'SKU, product name, quantities, and store ID required' }, { status: 400 });
      if (db.prepare('SELECT * FROM inventoryItems WHERE sku = ? AND storeId = ?').get(sku, storeId)) return NextResponse.json({ error: 'SKU already exists in this store' }, { status: 409 });
      const newItem = { id: uuidv4(), sku, productName, currentQuantity: Number(currentQuantity), reorderLevel: Number(reorderLevel), unitCost: Number(unitCost) || 0, storeId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.prepare('INSERT INTO inventoryItems (id, sku, productName, currentQuantity, reorderLevel, unitCost, storeId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(newItem.id, newItem.sku, newItem.productName, newItem.currentQuantity, newItem.reorderLevel, newItem.unitCost, newItem.storeId, newItem.createdAt, newItem.updatedAt);
      db.prepare('INSERT INTO inventoryHistory (id, itemId, changeType, quantityChange, previousQty, newQty, userId, notes, timestamp) VALUES (?, ?, \'created\', ?, 0, ?, ?, \'Item created\', ?)').run(uuidv4(), newItem.id, currentQuantity, currentQuantity, user.userId, new Date().toISOString());
      checkAndCreateAlerts(newItem.id);
      return NextResponse.json({ message: 'Inventory item created successfully', item: newItem });
    }
    if (path === '/inventory/adjust') {
      const { itemId, quantityChange, changeType, notes } = body;
      if (!itemId || quantityChange === undefined) return NextResponse.json({ error: 'Item ID and quantity change required' }, { status: 400 });
      const item = db.prepare('SELECT * FROM inventoryItems WHERE id = ?').get(itemId);
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      const previousQty = item.currentQuantity, newQty = previousQty + Number(quantityChange);
      if (newQty < 0) return NextResponse.json({ error: 'Insufficient quantity' }, { status: 400 });
      db.prepare('UPDATE inventoryItems SET currentQuantity = ?, updatedAt = ? WHERE id = ?').run(newQty, new Date().toISOString(), itemId);
      db.prepare('INSERT INTO inventoryHistory (id, itemId, changeType, quantityChange, previousQty, newQty, userId, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), itemId, changeType || 'adjustment', Number(quantityChange), previousQty, newQty, user.userId, notes || '', new Date().toISOString());
      checkAndCreateAlerts(itemId);
      return NextResponse.json({ message: 'Inventory adjusted successfully', previousQty, newQty });
    }
    if (path === '/inventory/import') {
      const { csvData, storeId } = body;
      if (!csvData || !storeId) return NextResponse.json({ error: 'CSV data and store ID required' }, { status: 400 });
      const parsed = Papa.parse(csvData, { header: true }), items = parsed.data.filter(row => row.SKU && row['Product Name']);
      let imported = 0, skipped = 0, errors = [];
      for (const row of items) {
        try {
          if (db.prepare('SELECT * FROM inventoryItems WHERE sku = ? AND storeId = ?').get(row.SKU, storeId)) { skipped++; continue; }
          const newItem = { id: uuidv4(), sku: row.SKU, productName: row['Product Name'], currentQuantity: Number(row['Current Quantity'] || 0), reorderLevel: Number(row['Reorder Level'] || 0), unitCost: Number(row['Unit Cost'] || 0), storeId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          db.prepare('INSERT INTO inventoryItems (id, sku, productName, currentQuantity, reorderLevel, unitCost, storeId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(newItem.id, newItem.sku, newItem.productName, newItem.currentQuantity, newItem.reorderLevel, newItem.unitCost, newItem.storeId, newItem.createdAt, newItem.updatedAt);
          checkAndCreateAlerts(newItem.id);
          imported++;
        } catch (error) {
          errors.push(`SKU ${row.SKU}: ${error.message}`);
        }
      }
      return NextResponse.json({ message: 'Import completed', imported, skipped, errors });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const db = getDatabase();
    const { pathname } = new URL(request.url);
    const path = pathname.replace('/api', '') || '/';
    const user = verifyToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (path.includes('/alerts/') && path.endsWith('/resolve')) {
      const alertId = path.split('/')[2];
      if (db.prepare('UPDATE alerts SET resolved = 1, resolvedBy = ?, resolvedAt = ? WHERE id = ?').run(user.userId, new Date().toISOString(), alertId).changes === 0) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
      return NextResponse.json({ message: 'Alert resolved successfully' });
    }
    const body = await request.json();
    if (path.startsWith('/stores/')) {
      const storeId = path.split('/')[2], { name, location, contactEmail, contactPhone } = body;
      if (db.prepare('UPDATE stores SET name = ?, location = ?, contactEmail = ?, contactPhone = ? WHERE id = ?').run(name, location, contactEmail, contactPhone, storeId).changes === 0) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      return NextResponse.json({ message: 'Store updated successfully' });
    }
    if (path.startsWith('/inventory/') && !path.includes('resolve')) {
      const itemId = path.split('/')[2], { sku, productName, currentQuantity, reorderLevel, unitCost, storeId } = body;
      const updates = [], params = [];
      if (sku !== undefined) { updates.push('sku = ?'); params.push(sku); }
      if (productName !== undefined) { updates.push('productName = ?'); params.push(productName); }
      if (currentQuantity !== undefined) { updates.push('currentQuantity = ?'); params.push(Number(currentQuantity)); }
      if (reorderLevel !== undefined) { updates.push('reorderLevel = ?'); params.push(Number(reorderLevel)); }
      if (unitCost !== undefined) { updates.push('unitCost = ?'); params.push(Number(unitCost)); }
      if (storeId !== undefined) { updates.push('storeId = ?'); params.push(storeId); }
      updates.push('updatedAt = ?'); params.push(new Date().toISOString()); params.push(itemId);
      if (db.prepare(`UPDATE inventoryItems SET ${updates.join(', ')} WHERE id = ?`).run(...params).changes === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      if (currentQuantity !== undefined || reorderLevel !== undefined) checkAndCreateAlerts(itemId);
      return NextResponse.json({ message: 'Item updated successfully' });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const db = getDatabase();
    const { pathname } = new URL(request.url);
    const path = pathname.replace('/api', '') || '/';
    const user = verifyToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (path.startsWith('/inventory/')) {
      const itemId = path.split('/')[2];
      db.prepare('DELETE FROM alerts WHERE itemId = ?').run(itemId);
      db.prepare('DELETE FROM inventoryHistory WHERE itemId = ?').run(itemId);
      if (db.prepare('DELETE FROM inventoryItems WHERE id = ?').run(itemId).changes === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      return NextResponse.json({ message: 'Item deleted successfully' });
    }
    if (path.startsWith('/stores/')) {
      const storeId = path.split('/')[2];
      if (db.prepare('SELECT COUNT(*) as count FROM inventoryItems WHERE storeId = ?').get(storeId).count > 0) return NextResponse.json({ error: 'Cannot delete store with existing inventory items' }, { status: 400 });
      if (db.prepare('DELETE FROM stores WHERE id = ?').run(storeId).changes === 0) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      return NextResponse.json({ message: 'Store deleted successfully' });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}