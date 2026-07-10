async function testDeviceUsers() {
  console.log('Testing GET /api/device-users endpoint...');
  try {
    const res = await fetch('http://localhost:3001/api/device-users');
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Users returned:', data.length);
    console.log('First 2 users:', JSON.stringify(data.slice(0, 2), null, 2));
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testDeviceUsers();
