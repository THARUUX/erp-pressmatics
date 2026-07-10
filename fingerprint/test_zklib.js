import ZKLib from 'node-zklib';
console.log('ZKLib:', ZKLib);
try {
  const zk = new ZKLib('192.168.1.201', 4370, 10000, 4000);
  console.log('Instance created successfully:', zk);
} catch (err) {
  console.error('Error creating instance:', err);
}
