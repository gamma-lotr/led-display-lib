// test-relay.ts
import { buildRelayControl, sendToScreen, CommunicationMode } from './src';
import * as dgram from 'dgram';

// Configuration – change to your device's IP and port
const HOST = '172.18.60.181';
const PORT = 9005;
const CARD_NUMBER = '0000000000';   // or your actual card number

// Helper to send a command
async function sendCommand(buffer: Buffer) {
  const socket = dgram.createSocket('udp4');
  return new Promise((resolve, reject) => {
    socket.send(buffer, PORT, HOST, (err) => {
      if (err) reject(err);
      else resolve(null);
      socket.close();
    });
  });
}

async function testRelay() {
  console.log('Testing relay control (0xA0)...');

  // Example 1: Open relay 1 (relayId = 0x00)
  console.log('Opening relay 1...');
  const openCmd = buildRelayControl(
    { relayId: 0x00, action: 'open' },
    { mode: CommunicationMode.GPRS, cardNumber: CARD_NUMBER }
  );
  await sendCommand(openCmd);
  await new Promise(r => setTimeout(r, 2000));

  // Example 2: Close relay 1
  console.log('Closing relay 1...');
  const closeCmd = buildRelayControl(
    { relayId: 0x00, action: 'close' },
    { mode: CommunicationMode.GPRS, cardNumber: CARD_NUMBER }
  );
  await sendCommand(closeCmd);
  await new Promise(r => setTimeout(r, 2000));

  // Example 3: Read relay 1 status (returns data – you may not see visible effect)
  console.log('Reading relay 1 status...');
  const readCmd = buildRelayControl(
    { relayId: 0x00, action: 'read' },
    { mode: CommunicationMode.GPRS, cardNumber: CARD_NUMBER }
  );
  await sendCommand(readCmd);
  console.log('Commands sent. Check your relay device.');

  // Note: For I/O ports, use relayId 0x02 to 0x06 (see protocol doc)
}

testRelay().catch(console.error);