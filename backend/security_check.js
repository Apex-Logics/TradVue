const { Client } = require('pg');

const client = new Client(process.env.DATABASE_URL);

async function runChecks() {
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    const checks = {
      check1_failed_logins: await client.query(`
        SELECT ip_address, email, COUNT(*) as attempts 
        FROM activity_log 
        WHERE action = 'login_failed' 
          AND created_at > NOW() - INTERVAL '30 minutes' 
        GROUP BY ip_address, email 
        ORDER BY attempts DESC
      `),
      check2_brute_force: await client.query(`
        SELECT ip_address, COUNT(*) as attempts, array_agg(DISTINCT email) as targeted_emails 
        FROM activity_log 
        WHERE action = 'login_failed' 
          AND created_at > NOW() - INTERVAL '30 minutes' 
        GROUP BY ip_address 
        HAVING COUNT(*) >= 3
        ORDER BY attempts DESC
      `),
      check3_suspicious_logins: await client.query(`
        SELECT a.ip_address, a.email, a.action, a.created_at 
        FROM activity_log a 
        WHERE a.created_at > NOW() - INTERVAL '30 minutes' 
          AND a.ip_address IN (
            SELECT ip_address 
            FROM activity_log 
            WHERE action = 'login_failed' 
              AND created_at > NOW() - INTERVAL '30 minutes'
          )
        ORDER BY a.created_at
      `),
      check4_volume: await client.query(`
        SELECT action, COUNT(*) as count 
        FROM activity_log 
        WHERE created_at > NOW() - INTERVAL '30 minutes' 
        GROUP BY action 
        ORDER BY count DESC
      `)
    };
    
    console.log('\n=== CHECK 1: Failed Logins ===');
    console.log(JSON.stringify(checks.check1_failed_logins.rows, null, 2));
    
    console.log('\n=== CHECK 2: Brute Force ===');
    console.log(JSON.stringify(checks.check2_brute_force.rows, null, 2));
    
    console.log('\n=== CHECK 3: Suspicious Logins ===');
    console.log(JSON.stringify(checks.check3_suspicious_logins.rows, null, 2));
    
    console.log('\n=== CHECK 4: Activity Volume ===');
    console.log(JSON.stringify(checks.check4_volume.rows, null, 2));
    
    // Determine result
    let result = 'clean';
    let details = [];
    
    if (checks.check2_brute_force.rows.length > 0) {
      const maxAttempts = Math.max(...checks.check2_brute_force.rows.map(r => r.attempts));
      if (maxAttempts >= 5) {
        result = 'alert';
        details.push(`${maxAttempts} failed logins from single IP`);
      } else {
        result = 'warning';
        details.push(`${maxAttempts} failed logins from single IP`);
      }
    }
    
    if (checks.check3_suspicious_logins.rows.length > 0) {
      if (result !== 'alert') result = 'warning';
      details.push(`${checks.check3_suspicious_logins.rows.length} successful logins from suspicious IPs`);
    }
    
    const volume = checks.check4_volume.rows;
    const maxVolume = volume[0]?.count || 0;
    if (maxVolume > 100) {
      if (result !== 'alert') result = 'warning';
      details.push(`High activity volume: ${maxVolume} actions`);
    }
    
    console.log('\n=== RESULT ===');
    console.log(JSON.stringify({ result, details }, null, 2));
    
    await client.end();
  } catch (err) {
    console.error('DATABASE ERROR:', err.message);
    process.exit(1);
  }
}

runChecks();
