import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_2dmxyB7jDNaz@ep-weathered-wildflower-a6xmcv0w.us-west-2.aws.neon.tech/neondb?sslmode=require';

async function checkDatabase() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    console.log('--- Verifying Database Import ---');
    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('No tables found! The import might have failed.');
      return;
    }
    
    console.log(`Found ${tablesResult.rows.length} tables in the database.`);
    console.log('Sample of tables:', tablesResult.rows.slice(0, 5).map(r => r.table_name).join(', ') + '...');
    
    // Check for a few core tables
    const tablesToCheck = ['users', 'customers', 'policies'];
    for (const tableName of tablesToCheck) {
      const exists = tablesResult.rows.find(r => r.table_name === tableName);
      if (exists) {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        console.log(`Table '${tableName}' exists and has ${countResult.rows[0].count} rows.`);
      }
    }
    
    console.log('\nVerification Complete!');
  } catch (err) {
    console.error('Error verifying database:', err);
  } finally {
    await client.end();
  }
}

checkDatabase();
