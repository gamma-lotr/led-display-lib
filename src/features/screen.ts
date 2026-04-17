import { buildScreenOn, buildScreenOff } from '../commands';
import { CommunicationMode } from '../types';
import { sendToScreen } from '../utils/send';

export async function screenOn(
  host: string,
  port: number,
  cardNumber: string = '13061913001'
): Promise<void> {
  const msg = buildScreenOn({ mode: CommunicationMode.GPRS, cardNumber });
  await sendToScreen(msg, host, port);
}

export async function screenOff(
  host: string,
  port: number,
  cardNumber: string = '13061913001'
): Promise<void> {
  const msg = buildScreenOff({ mode: CommunicationMode.GPRS, cardNumber });
  await sendToScreen(msg, host, port);
}