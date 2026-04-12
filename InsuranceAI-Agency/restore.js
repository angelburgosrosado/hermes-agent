import fs from 'fs';
import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_2dmxyB7jDNaz@ep-weathered-wildflower-a6xmcv0w.us-west-2.aws.neon.tech/neondb?sslmode=require';
const backupFile = '/Users/ABGlobalCEO/InsuranceAI-Agency/backups/db_backup_20251017_193546.sql';

async function restore() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to Neon database.');
    
    console.log('Reading full dump file...');
    const sql = fs.readFileSync(backupFile, 'utf8');
    
    console.log('Executing dump on the database... this may take a moment.');
    await client.query(sql);
    
    console.log('Successfully restored database dump!');
  } catch (err) {
    console.error('Error restoring database dump:', err);
  } finally {
    await client.end();
  }
}

restore();
