import * as dgram from 'dgram';
import { buildSavedProgram, buildProgramOnDemand, buildSetClock } from '../commands';
import {
  PartitionType,
  FontType,
  FontColor,
  EntryType,
  CommunicationMode,
  InstantProgramParams,
} from '../types';
import { sendToScreen } from '../utils/send';

export interface ParkingConfig {
  screenHost: string;
  screenPort?: number;
  listenPort?: number;
  timezone?: string;
  timeFormat?: string;
  dateFormat?: string;
  carPlateDisplayMs?: number;
  row1MessageDisplayMs?: number;
  udpTimeoutMs?: number;
  rowTexts?: string[];
  rowColors?: number[];
  rowEntryTypes?: EntryType[];
  rowEntrySpeeds?: number[];
  row1Text?: string;
  row1Color?: number;
  row2Text?: string;
  row2Color?: number;
  maxVisibleChars?: number;
}

export interface ParkingInstance {
  stop: () => void;
  showCarPlate: (plate: string, entryType?: EntryType, entrySpeed?: number) => Promise<void>;
  showRow1Message: (message: string, entryType?: EntryType, entrySpeed?: number) => Promise<void>;
}

export function startParkingSystem(config: ParkingConfig): ParkingInstance {
  const host = config.screenHost;
  const port = config.screenPort ?? 9005;
  const listenPort = config.listenPort ?? 9006;
  const cardNumber = '0000000000';
  const screenWidth = 64;
  const screenHeight = 64;
  const rowHeight = 16;
  const carPlateDisplayMs = config.carPlateDisplayMs ?? 10000;
  const row1MessageDisplayMs = config.row1MessageDisplayMs ?? carPlateDisplayMs;
  const udpTimeoutMs = config.udpTimeoutMs ?? 5000;
  const timeFormat = config.timeFormat ?? 'HH:MM';
  const dateFormat = config.dateFormat ?? 'YYYY-MM-DD';
  const timezone = config.timezone ?? 'Asia/Kuala_Lumpur';
  const maxVisibleChars = config.maxVisibleChars ?? 8;

  // Row base configs
  let defaultRows = config.rowTexts ?? ['Welcome', 'Car Parking', '00:00', '2025-01-01'];
  let defaultColors = config.rowColors ?? [0, 2, 1, 2];
  const defaultEntryTypes = config.rowEntryTypes ?? [
    EntryType.STATIC,
    EntryType.SCROLL_RIGHT,
    EntryType.STATIC,
    EntryType.SCROLL_RIGHT,
  ];
  const defaultEntrySpeeds = config.rowEntrySpeeds ?? [0, 5, 0, 5];

  if (config.row1Text !== undefined) defaultRows[0] = config.row1Text;
  if (config.row1Color !== undefined) defaultColors[0] = config.row1Color;
  if (config.row2Text !== undefined) defaultRows[1] = config.row2Text;
  if (config.row2Color !== undefined) defaultColors[1] = config.row2Color;

  const TIME_ROW_INDEX = 2;
  const CAR_PLATE_ROW_INDEX = 1;
  const DATE_ROW_INDEX = 3;

  let currentRows = defaultRows.map((text, i) => ({
    text,
    color: defaultColors[i],
    entryType: defaultEntryTypes[i],
    entrySpeed: defaultEntrySpeeds[i],
  }));

  // Store defaults for reverting
  const defaultRow1Text = defaultRows[0];
  const defaultRow1Color = defaultColors[0];
  const defaultRow1EntryType = defaultEntryTypes[0];
  const defaultRow1EntrySpeed = defaultEntrySpeeds[0];
  const defaultRow2Text = defaultRows[CAR_PLATE_ROW_INDEX];
  const defaultRow2Color = defaultColors[CAR_PLATE_ROW_INDEX];
  const defaultRow2EntryType = defaultEntryTypes[CAR_PLATE_ROW_INDEX];
  const defaultRow2EntrySpeed = defaultEntrySpeeds[CAR_PLATE_ROW_INDEX];

  let carPlateTimeout: NodeJS.Timeout | null = null;
  let row1MessageTimeout: NodeJS.Timeout | null = null;
  let timeUpdateInterval: NodeJS.Timeout | null = null;
  let udpServer: dgram.Socket | null = null;

  function mapColor(color: number): FontColor {
    const map: Record<number, FontColor> = {
      0: FontColor.RED,
      1: FontColor.GREEN,
      2: FontColor.YELLOW,
      3: FontColor.BLUE,
      4: FontColor.PURPLE,
      5: FontColor.CYAN,
      6: FontColor.WHITE,
    };
    return map[color] ?? FontColor.RED;
  }

  function formatDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '2025';
    const month = parts.find(p => p.type === 'month')?.value.padStart(2, '0') || '01';
    const day = parts.find(p => p.type === 'day')?.value.padStart(2, '0') || '01';
    return dateFormat.replace('YYYY', year).replace('MM', month).replace('DD', day);
  }

  function formatTime(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = parts.find(p => p.type === 'hour')?.value.padStart(2, '0') || '00';
    const minute = parts.find(p => p.type === 'minute')?.value.padStart(2, '0') || '00';
    return timeFormat.replace('HH', hour).replace('MM', minute);
  }

  function buildProgramParams(programId: number = 1): InstantProgramParams {
    const maxRows = Math.floor(screenHeight / rowHeight);
    const usableRows = currentRows.slice(0, maxRows);
    const partitions = usableRows.map((row, idx) => ({
      id: idx,
      left: 0,
      top: idx * rowHeight,
      width: screenWidth,
      height: rowHeight,
      type: PartitionType.TEXT,
      fontType: FontType.FONT_16X16,
      fontColor: mapColor(row.color),
      entryType: row.entryType,
      entrySpeed: row.entrySpeed,
      stayTime: 0xff,
      content: row.text,
    }));
    return {
      programId,
      playType: 'duration',
      playValue: 0,
      hasVoice: false,
      partitions,
    };
  }

  async function updateDisplay() {
    const params = buildProgramParams(1);
    const saveMsg = buildSavedProgram(params, { mode: CommunicationMode.GPRS, cardNumber });
    await sendToScreen(saveMsg, host, port, udpTimeoutMs);
    const playMsg = buildProgramOnDemand(
      { programId: 1, action: 'play', flag: 'continuous' },
      { mode: CommunicationMode.GPRS, cardNumber }
    );
    await sendToScreen(playMsg, host, port, udpTimeoutMs);
  }

  async function setDeviceClock() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => {
      const part = parts.find(p => p.type === type);
      return part ? parseInt(part.value, 10) : 0;
    };
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');

    const localDate = new Date(year, month - 1, day, hour, minute, second);
    const weekday = localDate.getDay();

    const msg = buildSetClock(
      { year, month, day, hour, minute, second, weekday },
      { mode: CommunicationMode.GPRS, cardNumber }
    );
    await sendToScreen(msg, host, port, udpTimeoutMs);
  }

  // Row1 message (status)
  async function showRow1Message(message: string, entryType?: EntryType, entrySpeed?: number) {
    if (entryType === undefined) {
      const isLong = message.length > maxVisibleChars;
      entryType = isLong ? EntryType.SCROLL_RIGHT : EntryType.STATIC;
      entrySpeed = isLong ? 5 : 0;
    }

    if (row1MessageTimeout) clearTimeout(row1MessageTimeout);
    currentRows[0].text = message;
    currentRows[0].entryType = entryType ?? EntryType.STATIC;
    if (entrySpeed !== undefined) currentRows[0].entrySpeed = entrySpeed;
    await updateDisplay();

    row1MessageTimeout = setTimeout(async () => {
      currentRows[0].text = defaultRow1Text;
      currentRows[0].entryType = defaultRow1EntryType;
      currentRows[0].entrySpeed = defaultRow1EntrySpeed;
      currentRows[0].color = defaultRow1Color;
      await updateDisplay();
      row1MessageTimeout = null;
    }, row1MessageDisplayMs);
  }

  // Car plate (row2)
  async function showCarPlate(plate: string, entryType?: EntryType, entrySpeed?: number) {
    if (entryType === undefined) {
      const isLong = plate.length > maxVisibleChars;
      entryType = isLong ? EntryType.SCROLL_RIGHT : EntryType.STATIC;
      entrySpeed = isLong ? 5 : 0;
    }

    if (carPlateTimeout) clearTimeout(carPlateTimeout);
    currentRows[CAR_PLATE_ROW_INDEX].text = plate;
    currentRows[CAR_PLATE_ROW_INDEX].entryType = entryType ?? EntryType.STATIC;
    if (entrySpeed !== undefined) currentRows[CAR_PLATE_ROW_INDEX].entrySpeed = entrySpeed;
    await updateDisplay();

    carPlateTimeout = setTimeout(async () => {
      currentRows[CAR_PLATE_ROW_INDEX].text = defaultRow2Text;
      currentRows[CAR_PLATE_ROW_INDEX].entryType = defaultRow2EntryType;
      currentRows[CAR_PLATE_ROW_INDEX].entrySpeed = defaultRow2EntrySpeed;
      currentRows[CAR_PLATE_ROW_INDEX].color = defaultRow2Color;
      await updateDisplay();
      carPlateTimeout = null;
    }, carPlateDisplayMs);
  }

  function startUdpListener() {
    udpServer = dgram.createSocket('udp4');
    udpServer.on('error', (err) => console.error('UDP listener error:', err));
    udpServer.on('message', async (msg, rinfo) => {
      const data = msg.toString().trim();
      if (!data) return;
      console.log(`[Parking] Received: "${data}" from ${rinfo.address}:${rinfo.port}`);

      let plate: string;
      let status: string | null = null;
      if (data.includes('|')) {
        const parts = data.split('|');
        plate = parts[0];
        status = parts[1];
      } else {
        plate = data;
      }

      await showCarPlate(plate);
      if (status) {
        await showRow1Message(status);
      }
    });
    udpServer.bind(listenPort, () => {
      console.log(`[Parking] Listening for car plates on port ${listenPort}`);
    });
  }

  function startTimeDateUpdater() {
    let lastTime = '';
    let lastDate = '';
    timeUpdateInterval = setInterval(async () => {
      const now = new Date();
      const newTime = formatTime(now);
      const newDate = formatDate(now);
      let changed = false;
      if (newTime !== lastTime) {
        currentRows[TIME_ROW_INDEX].text = newTime;
        lastTime = newTime;
        changed = true;
      }
      if (newDate !== lastDate) {
        currentRows[DATE_ROW_INDEX].text = newDate;
        lastDate = newDate;
        changed = true;
      }
      if (changed) await updateDisplay();
    }, 1000);
  }

  // Initialisation
  (async () => {
    try {
      await setDeviceClock();
      const now = new Date();
      currentRows[TIME_ROW_INDEX].text = formatTime(now);
      currentRows[DATE_ROW_INDEX].text = formatDate(now);
      await updateDisplay();
    } catch (err) {
      console.error('[Parking] Initial network sync failed, but starting clock anyway:', err);
    }
    
    startTimeDateUpdater();
    startUdpListener();
    console.log('[Parking] System started.');
  })();

  return {
    stop: () => {
      if (carPlateTimeout) clearTimeout(carPlateTimeout);
      if (row1MessageTimeout) clearTimeout(row1MessageTimeout);
      if (timeUpdateInterval) clearInterval(timeUpdateInterval);
      if (udpServer) udpServer.close();
      console.log('[Parking] System stopped.');
    },
    showCarPlate: async (plate: string, entryType?: EntryType, entrySpeed?: number) => {
      await showCarPlate(plate, entryType, entrySpeed);
    },
    showRow1Message: async (message: string, entryType?: EntryType, entrySpeed?: number) => {
      await showRow1Message(message, entryType, entrySpeed);
    },
  };
}

export { EntryType };