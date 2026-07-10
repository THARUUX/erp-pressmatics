async function testRealSync() {
  console.log('Testing real ZKTeco sync...');
  try {
    const res = await fetch('http://localhost:3001/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulate: false })
    });
    const data = await res.json();
    console.log('Sync status:', res.status);
    console.log('Sync response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testRealSync();
