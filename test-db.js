// test-db.js
const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '1234'
};

async function testConnection() {
    const client = new Client(dbConfig);
    try {
        await client.connect();
        console.log('✅ Database connected successfully!');
        const result = await client.query('SELECT version()');
        console.log('PostgreSQL version:', result.rows[0].version);
        await client.end();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
}

testConnection();