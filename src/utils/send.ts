import * as dgram from 'dgram';

export function sendToScreen(
  message: Buffer,
  host: string,
  port: number,
  timeoutMs = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('UDP send timeout'));
    }, timeoutMs);

    socket.on('message', () => {
      clearTimeout(timeout);
      socket.close();
      resolve();
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      socket.close();
      reject(err);
    });

    socket.send(message, port, host, (err) => {
      if (err) {
        clearTimeout(timeout);
        socket.close();
        reject(err);
      }
    });
  });
}