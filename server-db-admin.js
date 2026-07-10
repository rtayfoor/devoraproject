require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = 3000;

// Load pending transfers
async function loadPendingTransfers() {
    try {
        const response = await fetch('/api/admin/bank-transfer/pending');
        const transfers = await response.json();

        const container = document.getElementById('pendingTransfers');
        if (transfers.length === 0) {
            container.innerHTML = '<p>No pending transfers</p>';
            return;
        }

        let html = '<table class="admin-table">';
        html += `
            <thead>
                <tr>
                    <th>Order #</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Transfer Date</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
        `;

        transfers.forEach(transfer => {
            html += `
                <tr>
                    <td>${transfer.orders.order_number}</td>
                    <td>€${transfer.amount}</td>
                    <td>${transfer.reference_number}</td>
                    <td>${new Date(transfer.transfer_date).toLocaleDateString()}</td>
                    <td>
                        <button onclick="verifyTransfer(${transfer.id}, 'verified')" class="btn btn-success">Verify</button>
                        <button onclick="verifyTransfer(${transfer.id}, 'rejected')" class="btn btn-danger">Reject</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading transfers:', error);
    }
}

// Verify or reject transfer
async function verifyTransfer(transferId, status) {
    if (!confirm(`Are you sure you want to ${status} this transfer?`)) return;

    try {
        const response = await fetch('/api/admin/bank-transfer/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderId: transferId,
                status: status,
                notes: prompt('Add any notes:') || ''
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Transfer ${status} successfully`);
            loadPendingTransfers(); // Refresh the list
        } else {
            alert(data.error || 'Failed to process transfer');
        }
    } catch (error) {
        console.error('Error verifying transfer:', error);
        alert('An error occurred');
    }
}
// PostgreSQL connection configuration
require('dotenv').config();

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres'
};
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Helper to get connection for specific database
async function getDbConnection(databaseName) {
  return new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1234',
    database: databaseName
  });
}

// ============= DATABASE MANAGEMENT =============

// Get all databases
app.get('/api/admin/databases', async (req, res) => {
  const pool = new Pool(poolConfig);
  try {
    const result = await pool.query(`
      SELECT datname FROM pg_database 
      WHERE datistemplate = false 
      AND datname NOT IN ('postgres')
      ORDER BY datname
    `);
    res.json({ databases: result.rows.map(r => r.datname) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Create new database
app.post('/api/admin/databases', async (req, res) => {
  const { dbName } = req.body;
  if (!dbName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
    return res.status(400).json({ error: 'Invalid database name' });
  }
  const pool = new Pool(poolConfig);
  try {
    await pool.query(`CREATE DATABASE ${dbName}`);
    res.json({ success: true, message: `Database ${dbName} created` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Drop database
app.delete('/api/admin/databases/:dbName', async (req, res) => {
  const { dbName } = req.params;
  const pool = new Pool(poolConfig);
  try {
    await pool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
    `, [dbName]);
    await pool.query(`DROP DATABASE IF EXISTS ${dbName}`);
    res.json({ success: true, message: `Database ${dbName} dropped` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Execute raw SQL query
app.post('/api/admin/query', async (req, res) => {
  const { database, sql } = req.body;
  if (!database || !sql) {
    return res.status(400).json({ error: 'Database and SQL query required' });
  }
  
  const pool = await getDbConnection(database);
  try {
    const result = await pool.query(sql);
    res.json({ 
      success: true, 
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map(f => f.name) || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// ============= TABLE MANAGEMENT =============

// Get all tables in a database (FIXED - works with your existing tables)
app.get('/api/admin/:database/tables', async (req, res) => {
  const { database } = req.params;
  const pool = await getDbConnection(database);
  try {
    const result = await pool.query(`
      SELECT 
        tablename,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename AND table_schema = 'public') as column_count,
        (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = tablename AND constraint_type = 'PRIMARY KEY') as has_pk
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    res.json({ tables: result.rows });
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Create new table
app.post('/api/admin/:database/tables', async (req, res) => {
  const { database } = req.params;
  const { tableName, columnsDefinition } = req.body;
  
  if (!tableName || !columnsDefinition) {
    return res.status(400).json({ error: 'Table name and columns required' });
  }
  
  const pool = await getDbConnection(database);
  try {
    const columns = columnsDefinition.split('\n')
      .filter(line => line.trim())
      .join(',\n  ');
    
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columns}\n)`;
    await pool.query(sql);
    res.json({ success: true, message: `Table ${tableName} created` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Drop table
app.delete('/api/admin/:database/tables/:tableName', async (req, res) => {
  const { database, tableName } = req.params;
  const pool = await getDbConnection(database);
  try {
    await pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
    res.json({ success: true, message: `Table ${tableName} dropped` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Get table schema
app.get('/api/admin/:database/schema/:tableName', async (req, res) => {
  const { database, tableName } = req.params;
  const pool = await getDbConnection(database);
  try {
    const columnsResult = await pool.query(`
      SELECT 
        column_name, 
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    
    const pkResult = await pool.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_name = $1
        AND tc.table_schema = 'public'
    `, [tableName]);
    
    const primaryKeyCol = pkResult.rows[0]?.column_name;
    
    const columns = columnsResult.rows.map(col => ({
      name: col.column_name,
      type: col.data_type,
      isPrimary: col.column_name === primaryKeyCol,
      nullable: col.is_nullable === 'YES',
      default: col.column_default,
      maxLength: col.character_maximum_length
    }));
    
    res.json({ columns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Get table data with pagination
app.get('/api/admin/:database/data/:tableName', async (req, res) => {
  const { database, tableName } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  
  const pool = await getDbConnection(database);
  try {
    // Get total count
    const countResult = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`);
    const totalRows = parseInt(countResult.rows[0].count);
    
    // Get column info
    const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    
    // Get primary key
    const pkResult = await pool.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_name = $1
        AND tc.table_schema = 'public'
    `, [tableName]);
    
    const primaryKeyCol = pkResult.rows[0]?.column_name;
    
    const columns = columnsResult.rows.map(col => ({
      name: col.column_name,
      type: col.data_type,
      isPrimary: col.column_name === primaryKeyCol
    }));
    
    // Get data with pagination (using quoted identifiers for safety)
    const dataResult = await pool.query(`SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`, [limit, offset]);
    
    res.json({
      columns,
      rows: dataResult.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRows / limit),
        totalRows,
        limit
      }
    });
  } catch (err) {
    console.error('Error loading table data:', err);
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Insert row
app.post('/api/admin/:database/row/:tableName', async (req, res) => {
  const { database, tableName } = req.params;
  const { row } = req.body;
  
  const pool = await getDbConnection(database);
  try {
    const columns = Object.keys(row);
    const values = Object.values(row);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(sql, values);
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Update row
app.put('/api/admin/:database/row/:tableName', async (req, res) => {
  const { database, tableName } = req.params;
  const { pkCol, pkValue, updatedRow } = req.body;
  
  const pool = await getDbConnection(database);
  try {
    const setClause = Object.keys(updatedRow)
      .map((col, i) => `"${col}" = $${i + 1}`)
      .join(', ');
    const values = [...Object.values(updatedRow), pkValue];
    
    const sql = `UPDATE "${tableName}" SET ${setClause} WHERE "${pkCol}" = $${values.length}`;
    await pool.query(sql, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Delete row
app.delete('/api/admin/:database/row/:tableName', async (req, res) => {
  const { database, tableName } = req.params;
  const { pkCol, pkValue } = req.body;
  
  const pool = await getDbConnection(database);
  try {
    await pool.query(`DELETE FROM "${tableName}" WHERE "${pkCol}" = $1`, [pkValue]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

// Serve the database admin HTML
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'db-admin-full.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'db-admin-full.html'));
});

app.listen(port, () => {
  console.log(`\n🚀 ========== DATABASE ADMIN PANEL ==========`);
  console.log(`✅ Server running at: http://localhost:${port}`);
  console.log(`📊 Admin Panel: http://localhost:${port}/admin`);
  console.log(`💾 Connected to PostgreSQL on localhost:5432`);
  console.log(`🔐 Username: postgres`);
  console.log(`============================================\n`);
});
