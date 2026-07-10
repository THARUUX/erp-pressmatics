import ZKLib from 'node-zklib';
const zk = new ZKLib('192.168.1.201', 4370, 10000, 4000);
console.log('ZKLib methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(zk)));
