import * as dgram from 'dgram';
import { buildQueryVersion } from '../commands';
import { CommunicationMode, BaseResponse } from '../types';
import { parseGprsResponse } from '../protocol';

export interface DeviceInfo {
  success: boolean;
  errorMessage?: string;
  protocolVersion?: number;
  hardwareVersion?: string;
  softwareVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
  // Add other fields as needed
}

/**
 * Send a version query to the LED screen and wait for the response.
 * Uses command 0x0D (Query Version).
 */
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
        resolve({
          success: false,
          errorMessage: `No response from device within ${timeoutMs}ms`,
        });
      }
    }, timeoutMs);

    socket.on('message', (data) => {
      try {
        // First, check if it's a valid GPRS response
        const parsed = parseGprsResponse(data);
        if (!parsed.success) {
          resolved = true;
          clearTimeout(timeout);
          socket.close();
          resolve({
            success: false,
            errorMessage: `Device returned error code 0x${parsed.errorCode.toString(16)}`,
          });
          return;
        }

        // Now parse the actual version data (after the header)
        // The response format for 0x0D is described in section 5.13 of the doc.
        // It returns:
        // - Error (1 byte, 0x01 = success)
        // - ProtoID (1 byte)
        // - Reserved (1 byte)
        // - HardPub (4 bytes, hardware version)
        // - BootPub (2 bytes, boot version)
        // - SoftPub (3 bytes, software version)
        // - Soft_DateTime (22 bytes)
        // - Control card application type (1 byte)
        // - Screen width (2 bytes, low-high)
        // - Screen height (2 bytes, low-high)

        // The response data starts after the GPRS header. We need to skip to the content.
        // Assuming parseGprsResponse returns rawData that includes the full packet including content.
        // For GPRS, the structure is: AA BB + 12-byte card + command + length + content + BB AA.
        // We need to find the content start.
        // Simpler approach: Use the rawData and parse according to the protocol.
        // We'll assume that data is the full UDP packet.

        let offset = 0;
        // Skip GPRS header (AA BB)
        offset += 2;
        // Skip 12-byte card number
        offset += 12;
        // Now at command byte (0x0D)
        if (data[offset] !== 0x0D) {
          throw new Error('Unexpected command in response');
        }
        offset += 1; // skip command
        // Length (2 bytes, low-high)
        const length = data[offset] + (data[offset + 1] << 8);
        offset += 2;
        // Content starts here
        const content = data.subarray(offset, offset + length);

        // Parse content according to 0x0D response format
        if (content.length < 1) {
          throw new Error('Response content too short');
        }
        const errorCode = content[0];
        if (errorCode !== 0x01) {
          resolve({
            success: false,
            errorMessage: `Device returned error 0x${errorCode.toString(16)}`,
          });
          socket.close();
          return;
        }

        // Now extract fields (offsets after error byte)
        let pos = 1;
        const protoId = content[pos++];
        const reserved = content[pos++];
        const hardPub = content.slice(pos, pos + 4).toString('hex'); // 4 bytes
        pos += 4;
        const bootPub = content.slice(pos, pos + 2).toString('hex');
        pos += 2;
        const softPub = content.slice(pos, pos + 3).toString('hex');
        pos += 3;
        // Skip 22 bytes of Soft_DateTime (optional)
        pos += 22;
        const appType = content[pos++];
        const screenWidth = content[pos] + (content[pos + 1] << 8);
        pos += 2;
        const screenHeight = content[pos] + (content[pos + 1] << 8);

        resolved = true;
        clearTimeout(timeout);
        socket.close();
        resolve({
          success: true,
          protocolVersion: protoId,
          hardwareVersion: hardPub,
          softwareVersion: softPub,
          screenWidth,
          screenHeight,
        });
      } catch (err) {
        resolved = true;
        clearTimeout(timeout);
        socket.close();
        const errorMessage = err instanceof Error ? err.message : String(err);
        resolve({
          success: false,
          errorMessage: `Failed to parse response: ${errorMessage}`,
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