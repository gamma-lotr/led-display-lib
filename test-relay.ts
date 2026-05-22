import { buildRelayControl, sendToScreen, CommunicationMode } from './src';

const HOST = '172.18.60.181';
const PORT = 9005;
const CARD_NUMBER = '0000000000';   // or use your actual card number

async function testRelay() {
  console.log('Testing relay control (0xA0)...');

  // Helper to send a relay command and wait for network send (not response)
  const sendRelay = async (action: 'open' | 'close' | 'read') => {
    const msg = buildRelayControl(
      { relayId: 0x00, action },
      { mode: CommunicationMode.GPRS, cardNumber: CARD_NUMBER }
    );
    await sendToScreen(msg, HOST, PORT);
    console.log(`  ${action} command sent`);
  };

  // Open relay 1
  console.log('Opening relay 1...');
  await sendRelay('open');
  await new Promise(r => setTimeout(r, 2000));

  // Close relay 1 – send twice to be sure
  console.log('Closing relay 1...');
  await sendRelay('close');
  await new Promise(r => setTimeout(r, 1000));
  await sendRelay('close');   // second attempt to guarantee it closes
  await new Promise(r => setTimeout(r, 1000));

  // Read status (optional, no visible change)
  console.log('Reading relay 1 status...');
  await sendRelay('read');

  console.log('Test finished. Relay should be closed now.');
  console.log('If still red, check wiring or try sending close command again manually.');
}

testRelay().catch(console.error);