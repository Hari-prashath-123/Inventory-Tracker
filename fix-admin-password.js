import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'inventory.db');
const db = new Database(DB_PATH);

async function fixAdminPassword() {
  console.log('🔧 Fixing admin password...');
  
  const newPasswordHash = await bcrypt.hash('admin', 10);
  
  const result = db.prepare('UPDATE users SET passwordHash = ? WHERE username = ?').run(
    newPasswordHash,
    'admin'
  );
  
  if (result.changes > 0) {
    console.log('✅ Admin password updated successfully');
    
    // Verify it works
    const user = db.prepare('SELECT username, passwordHash FROM users WHERE username = ?').get('admin');
    const isValid = await bcrypt.compare('admin', user.passwordHash);
    console.log(`✓ Password verification test: ${isValid ? 'PASS' : 'FAIL'}`);
  } else {
    console.log('❌ Failed to update admin password');
  }
  
  db.close();
}

fixAdminPassword().catch(console.error);
