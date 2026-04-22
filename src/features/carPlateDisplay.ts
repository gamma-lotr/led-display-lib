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
import { ParkingConfig } from './parking';

export class CarPlateService {
  private timer: NodeJS.Timeout | null = null;
  private config: ParkingConfig;

  constructor(config: ParkingConfig) {
    this.config = {
      screenPort: 9005,
      screenWidth: 64,
      screenHeight: 64,
      rowHeight: 16,
      carPlateDisplayMs: 10000,
      ...config,
    };
  }

  /**
   * Send a car plate to be displayed on the second row for a specific duration.
   * Only the second row is updated; other row configurations are ignored.
   * @param plate The car plate text to display
   */
  async sendPlate(plate: string): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    await this.updateDisplay(plate);

    // Set timeout to clear the display after the configured duration
    this.timer = setTimeout(async () => {
      await this.updateDisplay('');
      this.timer = null;
    }, this.config.carPlateDisplayMs);
  }

  private async updateDisplay(text: string): Promise<void> {
    const {
      screenHost,
      screenPort,
      cardNumber,
      screenWidth,
      screenHeight,
      rowHeight,
    } = this.config;

    if (!cardNumber) {
      throw new Error('cardNumber is required in ParkingConfig');
    }

    const params: InstantProgramParams = {
      programId: 0,
      playType: 'duration',
      playValue: 0,
      hasVoice: false,
      partitions: [
        {
          id: 0,
          left: 0,
          top: rowHeight!, // Second row (index 1)
          width: screenWidth!,
          height: rowHeight!,
          type: PartitionType.TEXT,
          fontType: FontType.FONT_16X16,
          fontColor: FontColor.YELLOW, // Default car plate color
          entryType: EntryType.STATIC,
          entrySpeed: 0,
          stayTime: 0xff,
          content: text,
        },
      ],
    };

    const msg = buildInstantProgram(params, {
      mode: CommunicationMode.GPRS,
      cardNumber,
    });

    await sendToScreen(msg, screenHost, screenPort!);
  }

  /**
   * Stop any active timers.
   */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Helper function to quickly send a car plate without manually managing a service instance.
 * Note: This won't handle overlapping calls gracefully (timers won't be shared).
 * For production use, instantiate CarPlateService.
 */
export async function sendCarPlateOnly(plate: string, config: ParkingConfig): Promise<void> {
  const service = new CarPlateService(config);
  await service.sendPlate(plate);
}
