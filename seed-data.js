import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'inventory.db');
const db = new Database(DB_PATH);

async function seedData() {
  console.log('🌱 Seeding database with example data...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin', 10);
  const adminId = uuidv4();
  
  try {
    db.prepare('INSERT INTO users (id, username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)').run(
      adminId,
      'admin',
      adminPassword,
      'admin',
      new Date().toISOString()
    );
    console.log('✓ Admin user created (username: admin, password: admin)');
  } catch (error) {
    console.log('ℹ Admin user already exists');
  }

  // Create sample stores
  const stores = [
    { name: 'Downtown Store', location: '123 Main St, New York, NY 10001', contactEmail: 'downtown@example.com', contactPhone: '(555) 123-4567' },
    { name: 'Westside Branch', location: '456 Oak Ave, Los Angeles, CA 90001', contactEmail: 'westside@example.com', contactPhone: '(555) 234-5678' },
    { name: 'North Mall', location: '789 Pine Rd, Chicago, IL 60601', contactEmail: 'northmall@example.com', contactPhone: '(555) 345-6789' }
  ];

  const storeIds = [];
  for (const store of stores) {
    const storeId = uuidv4();
    try {
      db.prepare('INSERT INTO stores (id, name, location, contactEmail, contactPhone, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(
        storeId,
        store.name,
        store.location,
        store.contactEmail,
        store.contactPhone,
        new Date().toISOString()
      );
      storeIds.push(storeId);
      console.log(`✓ Created store: ${store.name}`);
    } catch (error) {
      console.log(`ℹ Store already exists: ${store.name}`);
    }
  }

  // Create sample inventory items
  const inventoryItems = [
    // Downtown Store items
    { sku: 'ELEC-001', productName: 'Wireless Mouse', currentQuantity: 45, reorderLevel: 20, unitCost: 24.99, storeIndex: 0 },
    { sku: 'ELEC-002', productName: 'USB-C Cable', currentQuantity: 15, reorderLevel: 30, unitCost: 12.99, storeIndex: 0 },
    { sku: 'ELEC-003', productName: 'Laptop Stand', currentQuantity: 8, reorderLevel: 10, unitCost: 45.00, storeIndex: 0 },
    { sku: 'OFFICE-001', productName: 'A4 Paper Ream', currentQuantity: 120, reorderLevel: 50, unitCost: 8.50, storeIndex: 0 },
    { sku: 'OFFICE-002', productName: 'Blue Pens (Pack of 10)', currentQuantity: 5, reorderLevel: 15, unitCost: 6.99, storeIndex: 0 },
    
    // Westside Branch items
    { sku: 'ELEC-001', productName: 'Wireless Mouse', currentQuantity: 32, reorderLevel: 20, unitCost: 24.99, storeIndex: 1 },
    { sku: 'ELEC-004', productName: 'Bluetooth Keyboard', currentQuantity: 18, reorderLevel: 15, unitCost: 59.99, storeIndex: 1 },
    { sku: 'ELEC-005', productName: 'Webcam HD', currentQuantity: 7, reorderLevel: 10, unitCost: 79.99, storeIndex: 1 },
    { sku: 'FURNITURE-001', productName: 'Office Chair', currentQuantity: 3, reorderLevel: 5, unitCost: 199.99, storeIndex: 1 },
    { sku: 'FURNITURE-002', productName: 'Standing Desk', currentQuantity: 2, reorderLevel: 3, unitCost: 399.99, storeIndex: 1 },
    
    // North Mall items
    { sku: 'ELEC-002', productName: 'USB-C Cable', currentQuantity: 55, reorderLevel: 30, unitCost: 12.99, storeIndex: 2 },
    { sku: 'ELEC-006', productName: 'Monitor 24"', currentQuantity: 12, reorderLevel: 8, unitCost: 189.99, storeIndex: 2 },
    { sku: 'OFFICE-003', productName: 'Notebooks (5-Pack)', currentQuantity: 40, reorderLevel: 25, unitCost: 15.99, storeIndex: 2 },
    { sku: 'OFFICE-004', productName: 'Desk Organizer', currentQuantity: 22, reorderLevel: 10, unitCost: 18.50, storeIndex: 2 },
    { sku: 'SUPPLIES-001', productName: 'Whiteboard Markers', currentQuantity: 6, reorderLevel: 20, unitCost: 9.99, storeIndex: 2 }
  ];

  let itemsCreated = 0;
  for (const item of inventoryItems) {
    if (storeIds[item.storeIndex]) {
      const itemId = uuidv4();
      try {
        db.prepare('INSERT INTO inventoryItems (id, sku, productName, currentQuantity, reorderLevel, unitCost, storeId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          itemId,
          item.sku,
          item.productName,
          item.currentQuantity,
          item.reorderLevel,
          item.unitCost,
          storeIds[item.storeIndex],
          new Date().toISOString(),
          new Date().toISOString()
        );
        
        // Create history entry
        db.prepare('INSERT INTO inventoryHistory (id, itemId, changeType, quantityChange, previousQty, newQty, userId, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          uuidv4(),
          itemId,
          'created',
          item.currentQuantity,
          0,
          item.currentQuantity,
          adminId,
          'Initial stock',
          new Date().toISOString()
        );

        // Create alert if needed
        if (item.currentQuantity <= item.reorderLevel) {
          db.prepare('INSERT INTO alerts (id, itemId, storeId, sku, productName, currentQuantity, reorderLevel, alertType, triggered, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            uuidv4(),
            itemId,
            storeIds[item.storeIndex],
            item.sku,
            item.productName,
            item.currentQuantity,
            item.reorderLevel,
            'reorder',
            new Date().toISOString(),
            0
          );
        }

        itemsCreated++;
      } catch (error) {
        // Item already exists
      }
    }
  }

  console.log(`✓ Created ${itemsCreated} inventory items`);
  
  // Display summary
  const stats = {
    totalStores: db.prepare('SELECT COUNT(*) as count FROM stores').get().count,
    totalItems: db.prepare('SELECT COUNT(*) as count FROM inventoryItems').get().count,
    lowStockItems: db.prepare('SELECT COUNT(*) as count FROM inventoryItems WHERE currentQuantity <= reorderLevel').get().count,
    activeAlerts: db.prepare('SELECT COUNT(*) as count FROM alerts WHERE resolved = 0').get().count
  };

  console.log('\n📊 Database Summary:');
  console.log(`   Stores: ${stats.totalStores}`);
  console.log(`   Inventory Items: ${stats.totalItems}`);
  console.log(`   Low Stock Items: ${stats.lowStockItems}`);
  console.log(`   Active Alerts: ${stats.activeAlerts}`);
  console.log('\n🔐 Login credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin');
  console.log('\n✅ Seeding complete!');
}

seedData().then(() => {
  db.close();
  process.exit(0);
}).catch(error => {
  console.error('Error seeding data:', error);
  db.close();
  process.exit(1);
});
