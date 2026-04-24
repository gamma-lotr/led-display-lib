import { buildHeartbeat } from '../commands';
import { CommunicationMode } from '../types';
import { sendToScreen } from '../utils/send';

export async function sendHeartbeat(
  host: string,
  port: number,
  cardNumber: string
): Promise<void> {
  const msg = buildHeartbeat({ mode: CommunicationMode.GPRS, cardNumber });
  await sendToScreen(msg, host, port);
}