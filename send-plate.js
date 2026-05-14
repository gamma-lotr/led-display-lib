// send-plate.js
const dgram = require('dgram');
const client = dgram.createSocket('udp4');

const plate = process.argv[2] || 'ABC-1234';
const status = process.argv[3];        // e.g., "Registered" or "Unregistered"
const targetIP = '172.18.68.17';          // same machine where parking script runs
const targetPort = 9006;               // must match listenPort above

const message = status ? `${plate}|${status}` : plate;
client.send(Buffer.from(message), targetPort, targetIP, (err) => {
  if (err) console.error(err);
  else console.log(`Sent: ${message}`);
  client.close();
});