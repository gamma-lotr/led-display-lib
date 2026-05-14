import { buildMessage } from '../protocol';
import { sendToScreen } from '../utils/send';
import { CommandCode, CommunicationMode } from '../types';
import type { MessageOptions, RelayControlParams } from '../types';

export function buildRelayControl(
  params: RelayControlParams,
  options: MessageOptions = {}
): Buffer {
  const content = Buffer.alloc(2);
  content[0] = params.relayId;
  switch (params.action) {
    case 'open':
      content[1] = 0x00;
      break;
    case 'close':
      content[1] = 0x01;
      break;
    case 'read':
      content[1] = 0x02;
      break;
    default:
      throw new Error(`Invalid relay action: ${params.action}`);
  }
  return buildMessage(CommandCode.RELAY_CONTROL, content, options);
}

export async function sendRelayControl(
  host: string,
  port: number,
  cardNumber: string,
  relayId: number,
  action: 'open' | 'close' | 'read',
  timeoutMs?: number
): Promise<void> {
  const msg = buildRelayControl(
    { relayId, action },
    { mode: CommunicationMode.GPRS, cardNumber }
  );
  await sendToScreen(msg, host, port, timeoutMs);
}