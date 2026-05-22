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

/**
 * Fire-and-forget UDP send: resolves as soon as the packet is sent.
 * Use this for commands that do not produce a reply (e.g. relay control).
 */
export function sendToScreenNoWait(
  message: Buffer,
  host: string,
  port: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.send(message, port, host, (err) => {
      socket.close();
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}