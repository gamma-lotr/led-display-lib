import { buildInstantProgram } from '../commands';
import {
  PartitionType,
  FontType,
  FontColor,
  EntryType,
  CommunicationMode,
  InstantProgramParams,
} from '../types';
import { sendToScreen } from '../utils/send';

export async function clearScreen(
  host: string,
  port: number,
  cardNumber: string = '13061913001'
): Promise<void> {
  // Use a normal row with empty text. The content is empty, so nothing displays.
  const emptyProgram: InstantProgramParams = {
    programId: 0,
    playType: 'duration',
    playValue: 0,          // play forever
    hasVoice: false,
    partitions: [
      {
        id: 0,
        left: 0,
        top: 0,
        width: 64,          // use your screen width (can be any non‑zero)
        height: 16,         // use your row height
        type: PartitionType.TEXT,
        fontType: FontType.FONT_16X16,
        fontColor: FontColor.RED,   // any supported color, but content is empty
        entryType: EntryType.STATIC,
        entrySpeed: 0,
        stayTime: 0xff,
        content: '',        // empty string – nothing to display
      },
    ],
  };
  const msg = buildInstantProgram(emptyProgram, { mode: CommunicationMode.GPRS, cardNumber });
  await sendToScreen(msg, host, port);
}