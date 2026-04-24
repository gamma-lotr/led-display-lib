import * as dgram from 'dgram';
import { buildHeartbeat } from '../commands';
import { CommunicationMode } from '../types';
import { parseGprsResponse } from '../protocol';

export interface HeartbeatResult {
  success: boolean;
  returnFlag?: number;
  errorMessage?: string;
  rawData?: Buffer;
}

/**
 * Send a heartbeat to the LED screen and wait for the response.
 */
export async function sendHeartbeatAndWait(
  host: string,
  port: number,
  cardNumber: string,
  timeoutMs: number = 3000
): Promise<HeartbeatResult> {
  const msg = buildHeartbeat({ mode: CommunicationMode.GPRS, cardNumber });
  const socket = dgram.createSocket('udp4');

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        socket.close();
        resolve({
          success: false,
          errorMessage: `No response from device within ${timeoutMs}ms`,
        });
      }
    }, timeoutMs);

    socket.on('message', (data) => {
      try {
        const parsed = parseGprsResponse(data);
        if (parsed.success) {
          resolved = true;
          clearTimeout(timeout);
          socket.close();
          resolve({
            success: true,
            returnFlag: parsed.errorCode,
            rawData: data,
          });
        } else {
          resolved = true;
          clearTimeout(timeout);
          socket.close();
          resolve({
            success: false,
            returnFlag: parsed.errorCode,
            errorMessage: `Device returned error code 0x${parsed.errorCode.toString(16)}`,
            rawData: data,
          });
        }
      } catch (err) {
        resolved = true;
        clearTimeout(timeout);
        socket.close();
        const errorMessage = err instanceof Error ? err.message : String(err);
        resolve({
          success: false,
          errorMessage: `Failed to parse response: ${errorMessage}`,
          rawData: data,
        });
      }
    });

    socket.send(msg, port, host, (err) => {
      if (err) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.close();
          resolve({
            success: false,
            errorMessage: `Send error: ${err.message}`,
          });
        }
      }
    });
  });
}

/**
 * Simple heartbeat send-only (no response waiting).
 */
export async function sendHeartbeat(
  host: string,
  port: number,
  cardNumber: string
): Promise<void> {
  const msg = buildHeartbeat({ mode: CommunicationMode.GPRS, cardNumber });
  const socket = dgram.createSocket('udp4');
  return new Promise((resolve, reject) => {
    socket.send(msg, port, host, (err) => {
      socket.close();
      if (err) reject(err);
      else resolve();
    });
  });
}