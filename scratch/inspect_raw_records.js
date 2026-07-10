import ZKLib from 'node-zklib';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DEVICE_IP = process.env.ZKTECO_IP || '192.168.1.201';
const DEVICE_PORT = parseInt(process.env.ZKTECO_PORT || '4370', 10);

async function inspectRaw() {
  console.log(`Connecting to ${DEVICE_IP}:${DEVICE_PORT}...`);
  const zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 5000, 4000);
  try {
    await zkInstance.createSocket();
    
    // We will call the internal readWithBuffer method to get the raw buffer
    // GET_ATTENDANCE_LOGS command is 1007 (CMD_DUMP_ATTLOG)
    const REQUEST_DATA = {
      GET_ATTENDANCE_LOGS: 1007
    };
    
    console.log('Fetching raw logs...');
    const data = await zkInstance.readWithBuffer(REQUEST_DATA.GET_ATTENDANCE_LOGS);
    
    if (!data || !data.data) {
      console.log('No data returned.');
      return;
    }

    const RECORD_PACKET_SIZE = 40;
    let recordData = data.data.subarray(4);
    
    console.log(`Total buffer size: ${recordData.length} bytes.`);
    
    let count = 0;
    while (recordData.length >= RECORD_PACKET_SIZE && count < 5) {
      const buf = recordData.subarray(0, RECORD_PACKET_SIZE);
      
      const userSn = buf.readUIntLE(0, 2);
      const deviceUserId = buf.slice(2, 11).toString('ascii').split('\0').shift();
      const timeVal = buf.readUInt32LE(27);
      
      console.log(`\n--- Record #${count + 1} ---`);
      console.log(`Parsed User ID: ${deviceUserId}, SN: ${userSn}, TimeRaw: ${timeVal}`);
      console.log('Hex bytes:');
      
      // Print bytes formatted as:
      // Offset: byte0 byte1 ...
      let hexParts = [];
      for (let i = 0; i < RECORD_PACKET_SIZE; i++) {
        const hex = buf[i].toString(16).padStart(2, '0');
        hexParts.push(`${i}:${hex}`);
      }
      
      console.log(hexParts.slice(0, 10).join(' '));
      console.log(hexParts.slice(10, 20).join(' '));
      console.log(hexParts.slice(20, 30).join(' '));
      console.log(hexParts.slice(30, 40).join(' '));

      recordData = recordData.subarray(RECORD_PACKET_SIZE);
      count++;
    }
    
  } catch (err) {
    console.error('Error during raw inspection:', err);
  } finally {
    try {
      await zkInstance.disconnect();
    } catch (e) {}
  }
}

inspectRaw();
