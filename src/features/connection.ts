import * as dgram from 'dgram';
import { buildQueryVersion } from '../commands';
import { CommunicationMode } from '../types';

export interface DeviceInfo {
  success: boolean;
  errorMessage?: string;
  protocolVersion?: number;
  hardwareVersion?: string;
  softwareVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
}

export async function testConnection(
  host: string,
  port: number,
  cardNumber: string,
  timeoutMs: number = 5000
): Promise<DeviceInfo> {
  const msg = buildQueryVersion({ mode: CommunicationMode.GPRS, cardNumber });
  const socket = dgram.createSocket('udp4');

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        socket.close();
        resolve({ success: false, errorMessage: `No response within ${timeoutMs}ms` });
      }
    }, timeoutMs);

    socket.on('message', (data) => {
      try {
        // 1. Strip GPRS wrapper
        if (data[0] !== 0xAA || data[1] !== 0xBB) {
          throw new Error('Not a GPRS packet');
        }
        const serialStart = 2 + 12; // skip AA BB and 12‑byte card number
        const serialEnd = data.length - 2; // skip final BB AA
        const serialPacket = data.subarray(serialStart, serialEnd);
        if (serialPacket.length < 10) throw new Error('Serial packet too short');
        if (serialPacket[0] !== 0xEB || serialPacket[1] !== 0x90) {
          throw new Error('Invalid serial header');
        }
        const command = serialPacket[4];
        if (command !== 0x0D) {
          throw new Error(`Unexpected command: 0x${command.toString(16)}`);
        }
        const length = serialPacket[5] + (serialPacket[6] << 8);
        const content = serialPacket.subarray(7, 7 + length);
        if (content.length < 1) throw new Error('Empty content');
        const errorCode = content[0];
        if (errorCode !== 0x01) {
          resolve({ success: false, errorMessage: `Device error code: 0x${errorCode.toString(16)}` });
          cleanup();
          return;
        }

        // Parse full response (according to section 5.13)
        let pos = 1;
        const protoId = content[pos++];
        pos++; // reserved
        const hardPub = content.slice(pos, pos + 4).toString('hex'); pos += 4;
        const bootPub = content.slice(pos, pos + 2).toString('hex'); pos += 2; // boot version (not used)
        const softPub = content.slice(pos, pos + 3).toString('hex'); pos += 3;
        pos += 22; // skip Soft_DateTime
        pos++; // skip appType
        const screenWidth = content[pos] + (content[pos + 1] << 8); pos += 2;
        const screenHeight = content[pos] + (content[pos + 1] << 8);

        resolve({
          success: true,
          protocolVersion: protoId,
          hardwareVersion: hardPub,
          softwareVersion: softPub,
          screenWidth,
          screenHeight,
        });
        cleanup();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        resolve({ success: false, errorMessage: `Parse error: ${errorMessage}` });
        cleanup();
      }
    });

    socket.send(msg, port, host, (err) => {
      if (err && !resolved) {
        resolve({ success: false, errorMessage: `Send error: ${err.message}` });
        cleanup();
      }
    });

    function cleanup() {
      if (!resolved) resolved = true;
      clearTimeout(timeout);
      socket.close();
    }
  });
}