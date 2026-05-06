const dgram = require('dgram');
const client = dgram.createSocket('udp4');
const plate = process.argv[2] || 'ABC-1234';
const targetIP = '172.18.68.22';   // IP of the PC running the parking script
const targetPort = 9006;

client.send(Buffer.from(plate), targetPort, targetIP, (err) => {
  if (err) console.error(err);
  else console.log(`Sent: ${plate}`);
  client.close();
});