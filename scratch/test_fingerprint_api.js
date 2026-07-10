async function testAPIs() {
  console.log('Testing ZKTeco server APIs...');
  
  try {
    // 1. Check status
    const statusRes = await fetch('http://localhost:3001/api/status');
    const statusData = await statusRes.json();
    console.log('GET /api/status status:', statusRes.status);
    console.log('GET /api/status data:', JSON.stringify(statusData, null, 2));

    // 2. Perform simulation sync
    const syncRes = await fetch('http://localhost:3001/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulate: true })
    });
    const syncData = await syncRes.json();
    console.log('POST /api/sync status:', syncRes.status);
    console.log('POST /api/sync data:', JSON.stringify(syncData, null, 2));

    // 3. Check logs
    const logsRes = await fetch('http://localhost:3001/api/logs?page=1&limit=5');
    const logsData = await logsRes.json();
    console.log('GET /api/logs status:', logsRes.status);
    console.log('GET /api/logs data (first 2 rows):', JSON.stringify(logsData.data.slice(0, 2), null, 2));
    console.log('GET /api/logs pagination:', JSON.stringify(logsData.pagination, null, 2));

    // 4. Check mapping
    const mappingRes = await fetch('http://localhost:3001/api/mapping');
    const mappingData = await mappingRes.json();
    console.log('GET /api/mapping status:', mappingRes.status);
    console.log('GET /api/mapping count:', mappingData.length);
  } catch (err) {
    console.error('API Test Error:', err);
  }
}

testAPIs();
