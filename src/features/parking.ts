import * as dgram from 'dgram';
import { buildInstantProgram, buildSetClock } from '../commands';
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
  cardNumber?: string;
  screenWidth?: number;
  screenHeight?: number;
  rowHeight?: number;
  carPlateDisplayMs?: number;
  timeFormat?: string;
  dateFormat?: string;
  rowTexts?: string[];
  rowColors?: number[];
  rowEntryTypes?: EntryType[];
  rowEntrySpeeds?: number[];
}

export interface ParkingInstance {
  stop: () => void;
}

export function startParkingSystem(config: ParkingConfig): ParkingInstance {
  const host = config.screenHost;
  const port = config.screenPort ?? 9005;
  const listenPort = config.listenPort ?? 9006;
  const cardNumber = config.cardNumber ?? '13061913001';
  const screenWidth = config.screenWidth ?? 64;
  const screenHeight = config.screenHeight ?? 64;
  const rowHeight = config.rowHeight ?? 16;
  const carPlateDisplayMs = config.carPlateDisplayMs ?? 10000;
  const timeFormat = config.timeFormat ?? 'HH:MM';
  const dateFormat = config.dateFormat ?? 'YYYY-MM-DD';

  // Row order: 0: Welcome, 1: Car Parking, 2: Time, 3: Date
  const defaultRows = config.rowTexts ?? ['Welcome', 'Car Parking', '00:00', '2025-01-01'];
  const defaultColors = config.rowColors ?? [0, 2, 1, 2];
  const defaultEntryTypes = config.rowEntryTypes ?? [
    EntryType.STATIC,
    EntryType.SCROLL_RIGHT,
    EntryType.STATIC,
    EntryType.SCROLL_RIGHT,
  ];
  const defaultEntrySpeeds = config.rowEntrySpeeds ?? [0, 5, 0, 5];

  const TIME_ROW_INDEX = 2;        // third row (0‑based)
  const CAR_PLATE_ROW_INDEX = 1;   // second row
  const DATE_ROW_INDEX = 3;        // fourth row

  let currentRows = defaultRows.map((text, i) => ({
    text,
    color: defaultColors[i],
    entryType: defaultEntryTypes[i],
    entrySpeed: defaultEntrySpeeds[i],
  }));

  let carPlateTimeout: NodeJS.Timeout | null = null;
  let timeUpdateInterval: NodeJS.Timeout | null = null;
  let udpServer: dgram.Socket | null = null;

  // Helper: map color number to FontColor enum
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return dateFormat.replace('YYYY', String(year)).replace('MM', month).replace('DD', day);
  }

  function formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return timeFormat.replace('HH', hours).replace('MM', minutes);
  }

  function buildProgramParams(): InstantProgramParams {
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
      programId: 0,
      playType: 'duration',
      playValue: 0,
      hasVoice: false,
      partitions,
    };
  }

  async function updateDisplay() {
    const params = buildProgramParams();
    const msg = buildInstantProgram(params, { mode: CommunicationMode.GPRS, cardNumber });
    await sendToScreen(msg, host, port);
  }

  async function setDeviceClock() {
    const now = new Date();
    const msg = buildSetClock(
      {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        weekday: now.getDay(),
      },
      { mode: CommunicationMode.GPRS, cardNumber }
    );
    await sendToScreen(msg, host, port);
  }

  async function showCarPlate(plate: string) {
    if (carPlateTimeout) clearTimeout(carPlateTimeout);
    currentRows[CAR_PLATE_ROW_INDEX].text = plate;
    currentRows[CAR_PLATE_ROW_INDEX].entryType = EntryType.STATIC;
    await updateDisplay();

    carPlateTimeout = setTimeout(async () => {
      currentRows[CAR_PLATE_ROW_INDEX].text = defaultRows[CAR_PLATE_ROW_INDEX];
      currentRows[CAR_PLATE_ROW_INDEX].entryType = defaultEntryTypes[CAR_PLATE_ROW_INDEX];
      currentRows[CAR_PLATE_ROW_INDEX].entrySpeed = defaultEntrySpeeds[CAR_PLATE_ROW_INDEX];
      await updateDisplay();
      carPlateTimeout = null;
    }, carPlateDisplayMs);
  }

  function startUdpListener() {
    udpServer = dgram.createSocket('udp4');
    udpServer.on('error', (err) => console.error('UDP listener error:', err));
    udpServer.on('message', (msg, rinfo) => {
      const plate = msg.toString().trim();
      if (plate) {
        console.log(`[Parking] Received plate: "${plate}" from ${rinfo.address}:${rinfo.port}`);
        showCarPlate(plate).catch(console.error);
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

  // Initialise everything
  (async () => {
    await setDeviceClock();
    const now = new Date();
    currentRows[TIME_ROW_INDEX].text = formatTime(now);
    currentRows[DATE_ROW_INDEX].text = formatDate(now);
    await updateDisplay();
    startTimeDateUpdater();
    startUdpListener();
    console.log('[Parking] System started.');
  })();

  return {
    stop: () => {
      if (carPlateTimeout) clearTimeout(carPlateTimeout);
      if (timeUpdateInterval) clearInterval(timeUpdateInterval);
      if (udpServer) udpServer.close();
      console.log('[Parking] System stopped.');
    },
  };
}