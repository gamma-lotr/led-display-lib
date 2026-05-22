import { buildPlayVoice, buildVolumeAdjust } from '../commands';
import { sendToScreen } from '../utils/send';
import { CommunicationMode } from '../types';

export interface PlayVoiceOptions {
  playCount?: number;   // 0 or 255 = continuous, 1 = once, etc.
  encoding?: 0 | 1;     // 0 = Unicode, 1 = GBK
}

export async function playVoice(
  host: string,
  port: number,
  cardNumber: string,
  text: string,
  options: PlayVoiceOptions = {}
): Promise<void> {
  const { playCount = 1, encoding = 0 } = options;
  const msg = buildPlayVoice({ content: text, playCount, encoding }, { mode: CommunicationMode.GPRS, cardNumber });
  await sendToScreen(msg, host, port);
}

export async function setVolume(
  host: string,
  port: number,
  cardNumber: string,
  level: number,          // 0-15 for Android
  isAndroid: boolean = true
): Promise<void> {
  const msg = buildVolumeAdjust({ isAndroid, type: 'manual', value: level }, { mode: CommunicationMode.GPRS, cardNumber });
  await sendToScreen(msg, host, port);
}