/**
 * LGSV1301 Protocol Message Builder and Parser
 */

import {
  PROTOCOL,
  CommandCode,
  ErrorCode,
  CommunicationMode,
  MessageOptions,
  BaseResponse,
} from './types';

/**
 * Calculate checksum for the protocol
 * Sum all bytes from header to content, then take one's complement
 */
export function calculateChecksum(data: Buffer): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
  }
  return (~sum) & 0xff;
}

/**
 * Build a serial protocol message
 */
export function buildSerialMessage(
  command: CommandCode,
  content: Buffer = Buffer.alloc(0),
  options: MessageOptions = {}
): Buffer {
  const address = options.address ?? PROTOCOL.BROADCAST_ADDRESS;
  const cardType = options.cardType ?? PROTOCOL.DEFAULT_CARD_TYPE;

  // Message structure: EB 90 [Address] [CardType] [Command] [LengthLow] [LengthHigh] [Content] [Checksum] EF
  const headerLength = 7; // EB 90 Address CardType Command LengthLow LengthHigh
  const contentLength = content.length;

  const message = Buffer.alloc(headerLength + contentLength + 2); // +2 for checksum and end byte

  // Header
  message[0] = PROTOCOL.SERIAL_HEADER_1;
  message[1] = PROTOCOL.SERIAL_HEADER_2;
  message[2] = address;
  message[3] = cardType;
  message[4] = command;

  // Length (little-endian: low byte first)
  message[5] = contentLength & 0xff;
  message[6] = (contentLength >> 8) & 0xff;

  // Content
  if (contentLength > 0) {
    content.copy(message, headerLength);
  }

  // Calculate checksum (from header to content, excluding end byte)
  const checksumData = message.subarray(0, headerLength + contentLength);
  message[headerLength + contentLength] = calculateChecksum(checksumData);

  // End byte
  message[headerLength + contentLength + 1] = PROTOCOL.SERIAL_END;

  return message;
}

/**
 * Build a GPRS protocol message
 */
export function buildGprsMessage(
  command: CommandCode,
  content: Buffer = Buffer.alloc(0),
  options: MessageOptions = {}
): Buffer {
  const cardNumber = options.cardNumber;

  // Build the serial message first
  const serialMessage = buildSerialMessage(command, content, options);

  // GPRS format: AA BB [CardNumber(12 bytes)] [SerialMessage] BB AA
  const gprsMessage = Buffer.alloc(2 + 12 + serialMessage.length + 2);

  // GPRS header
  gprsMessage[0] = PROTOCOL.GPRS_HEADER_1;
  gprsMessage[1] = PROTOCOL.GPRS_HEADER_2;

  // Card number (12 bytes)
  // If no card number provided or empty, use null bytes (0x00)
  // Otherwise use ASCII encoding
  if (cardNumber && cardNumber.length > 0 && !/^0+$/.test(cardNumber)) {
    const paddedCardNumber = cardNumber.padEnd(12, '0').substring(0, 12);
    Buffer.from(paddedCardNumber, 'ascii').copy(gprsMessage, 2);
  }
  // else: leave as zeros (Buffer.alloc initializes to 0x00)

  // Serial message
  serialMessage.copy(gprsMessage, 14);

  // GPRS tail
  gprsMessage[gprsMessage.length - 2] = PROTOCOL.GPRS_END_1;
  gprsMessage[gprsMessage.length - 1] = PROTOCOL.GPRS_END_2;

  return gprsMessage;
}

/**
 * Build a protocol message based on communication mode
 */
export function buildMessage(
  command: CommandCode,
  content: Buffer = Buffer.alloc(0),
  options: MessageOptions = {}
): Buffer {
  if (options.mode === CommunicationMode.GPRS) {
    return buildGprsMessage(command, content, options);
  }
  return buildSerialMessage(command, content, options);
}

/**
 * Parse a serial protocol response
 */
export function parseSerialResponse(data: Buffer): BaseResponse {
  if (data.length < 9) {
    return {
      success: false,
      errorCode: ErrorCode.DATA_LENGTH_INCORRECT,
      rawData: data,
    };
  }

  // Verify header
  if (data[0] !== PROTOCOL.SERIAL_HEADER_1 || data[1] !== PROTOCOL.SERIAL_HEADER_2) {
    return {
      success: false,
      errorCode: ErrorCode.GPRS_PROTOCOL_ERROR,
      rawData: data,
    };
  }

  // Verify end byte
  if (data[data.length - 1] !== PROTOCOL.SERIAL_END) {
    return {
      success: false,
      errorCode: ErrorCode.GPRS_PROTOCOL_ERROR,
      rawData: data,
    };
  }

  // Extract fields
  const contentLength = data[5] | (data[6] << 8);
  const expectedLength = 7 + contentLength + 2; // header + content + checksum + end

  if (data.length < expectedLength) {
    return {
      success: false,
      errorCode: ErrorCode.DATA_LENGTH_INCORRECT,
      rawData: data,
    };
  }

  // Verify checksum
  const checksumData = data.subarray(0, 7 + contentLength);
  const expectedChecksum = calculateChecksum(checksumData);
  const actualChecksum = data[7 + contentLength];

  if (expectedChecksum !== actualChecksum) {
    return {
      success: false,
      errorCode: ErrorCode.CHECKSUM_ERROR,
      rawData: data,
    };
  }

  // Extract content (first byte is typically the result/error code)
  const content = data.subarray(7, 7 + contentLength);
  const resultCode = contentLength > 0 ? content[0] : ErrorCode.SUCCESS;

  return {
    success: resultCode === ErrorCode.SUCCESS || resultCode === 0x02,
    errorCode: resultCode,
    rawData: content,
  };
}

/**
 * Parse a GPRS protocol response
 */
export function parseGprsResponse(data: Buffer): BaseResponse {
  // GPRS format: AA BB [CardNumber(12 bytes)] [SerialMessage] BB AA
  if (data.length < 18) {
    return {
      success: false,
      errorCode: ErrorCode.DATA_LENGTH_INCORRECT,
      rawData: data,
    };
  }

  // Verify GPRS header
  if (data[0] !== PROTOCOL.GPRS_HEADER_1 || data[1] !== PROTOCOL.GPRS_HEADER_2) {
    // Maybe it's a serial response
    return parseSerialResponse(data);
  }

  // Verify GPRS tail
  if (
    data[data.length - 2] !== PROTOCOL.GPRS_END_1 ||
    data[data.length - 1] !== PROTOCOL.GPRS_END_2
  ) {
    return {
      success: false,
      errorCode: ErrorCode.GPRS_PROTOCOL_ERROR,
      rawData: data,
    };
  }

  // Extract serial message and parse it
  const serialMessage = data.subarray(14, data.length - 2);
  return parseSerialResponse(serialMessage);
}

/**
 * Parse a protocol response based on communication mode
 */
export function parseResponse(
  data: Buffer,
  mode: CommunicationMode = CommunicationMode.SERIAL
): BaseResponse {
  if (mode === CommunicationMode.GPRS) {
    return parseGprsResponse(data);
  }
  return parseSerialResponse(data);
}

/**
 * Convert a string to Unicode (UTF-16LE) buffer
 */
export function stringToUnicode(str: string): Buffer {
  return Buffer.from(str, 'utf16le');
}

/**
 * Convert a string to GBK buffer
 * Note: Node.js doesn't natively support GBK, this is a simplified version
 * For full GBK support, use iconv-lite library
 */
export function stringToGbk(str: string): Buffer {
  // For ASCII-compatible strings, this works
  // For Chinese characters, you'd need iconv-lite
  return Buffer.from(str, 'latin1');
}

/**
 * Convert Unicode (UTF-16LE) buffer to string
 */
export function unicodeToString(data: Buffer): string {
  return data.toString('utf16le');
}

/**
 * Write a 16-bit value in little-endian format
 */
export function writeUInt16LE(buffer: Buffer, value: number, offset: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
}

/**
 * Read a 16-bit value in little-endian format
 */
export function readUInt16LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

/**
 * Write a 32-bit value in little-endian format
 */
export function writeUInt32LE(buffer: Buffer, value: number, offset: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
  buffer[offset + 2] = (value >> 16) & 0xff;
  buffer[offset + 3] = (value >> 24) & 0xff;
}

/**
 * Read a 32-bit value in little-endian format
 */
export function readUInt32LE(buffer: Buffer, offset: number): number {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  );
}
