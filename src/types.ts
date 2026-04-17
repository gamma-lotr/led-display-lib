/**
 * LGSV1301 LED Screen Protocol Types
 */

// Protocol Constants
export const PROTOCOL = {
  SERIAL_HEADER_1: 0xeb,
  SERIAL_HEADER_2: 0x90,
  SERIAL_END: 0xef,
  GPRS_HEADER_1: 0xaa,
  GPRS_HEADER_2: 0xbb,
  GPRS_END_1: 0xbb,
  GPRS_END_2: 0xaa,
  BROADCAST_ADDRESS: 0xff,
  DEFAULT_CARD_TYPE: 0x13,
} as const;

// Command codes
export enum CommandCode {
  PLAY_VOICE = 0x06,
  SET_RELAY_INFO = 0x09,
  READ_RELAY_INFO = 0x0a,
  QUERY_BRIGHTNESS = 0x0c,
  QUERY_VERSION = 0x0d,
  QUERY_VOLUME = 0x0e,
  SCREEN_OFF = 0x12,
  SCREEN_ON = 0x13,
  SET_CLOCK = 0x14,
  TIMER_SWITCH_SCREEN = 0x17,
  BRIGHTNESS_ADJUST = 0x1c,
  SEND_INSTANT_PROGRAM = 0x20,
  SEND_SAVED_PROGRAM = 0x24,
  PROGRAM_ON_DEMAND = 0x2a,
  RESET_SYSTEM = 0x43,
  QUERY_SIMPLE_VERSION = 0x4e,
  GET_SYSTEM_VERSION = 0x4f,
  VOLUME_ADJUST = 0x83,
  TIMED_VOICE = 0x84,
  RELAY_CONTROL = 0xa0,
  HEARTBEAT = 0xa5,
  TEMPLATE_DISPLAY_GBK = 0xc8,
  TEMPLATE_DISPLAY_UNICODE = 0xcc,
  TEMPLATE_DISPLAY_COLOR = 0xc4,
  TABLE_DISPLAY = 0xcd,
  TEMPLATE_WITH_CURSOR = 0xce,
}

// Error codes
export enum ErrorCode {
  SUCCESS = 0x01,
  CHECKSUM_ERROR = 0x71,
  CARD_TYPE_ERROR = 0x72,
  CARD_ADDRESS_ERROR = 0x73,
  GPRS_DATA_LENGTH_ERROR = 0x75,
  GPRS_PROTOCOL_ERROR = 0x76,
  GPRS_CARD_NUMBER_ERROR = 0x77,
  PROTOCOL_NOT_SUPPORTED = 0x80,
  DATA_EXCEEDS_8K = 0x81,
  OBJECT_NOT_EXIST = 0x83,
  TEMPLATE_NOT_SET = 0x84,
  CELL_EXCEEDS_TABLE = 0x85,
  ROW_INFO_INCORRECT = 0x86,
  TABLE_NOT_SET = 0x87,
  UNDEFINED_INSTRUCTION = 0xec,
  DATA_LENGTH_INCORRECT = 0xe4,
  PARAMETER_ERROR = 0xe5,
  NO_USERS = 0xe6,
  COUNT_IS_ZERO = 0xe7,
  COUNT_EXCEEDS_MAX = 0xe8,
}

// Font types
export enum FontType {
  COMPUTER_FONT = 0x00,
  FONT_16X16 = 0x01,
  FONT_24X24 = 0x02,
  FONT_32X32 = 0x03,
  FONT_12X12 = 0x04,
  FONT_48X48 = 0x05,
  FONT_64X64 = 0x06,
}

// Font colors - ONLY SUPPORT RED, GREEN, YELLOW
export enum FontColor {
  RED = 0x00,
  GREEN = 0x01,
  YELLOW = 0x02,
  BLUE = 0x03,
  PURPLE = 0x04,
  CYAN = 0x05,
  WHITE = 0x06,
}

// Entry animation types - ONLY SUPPORT STATIC, SCROLL_UP, SCROLL_LEFT
export enum EntryType {
  STATIC = 0x00,
  SCROLL_LEFT = 0x01, // STATIC
  SCROLL_RIGHT = 0x02, // SCROLL_LEFT
  SCROLL_UP = 0x03, // SCROLL_LEFT
  SCROLL_DOWN = 0x04, //SCROLL_UP
  BLINK = 0x05, // SCROLL_DOWN
  TEST6 = 0x06, // SCROLL_LEFT
  TEST7 = 0x07, // SCROLL_LEFT
  TEST8 = 0x08, //SCROLL_UP
  TEST9 = 0x09, //SCROLL_DOWN
}

// Partition types
export enum PartitionType {
  TEXT = 0x00,
  IMAGE = 0x01,
  GIF = 0x02,
  DIAL_CLOCK = 0x03,
  DIGITAL_TIME = 0x04,
  COUNTDOWN = 0x05,
  BASIC_GRAPHICS = 0x06,
  PRE_SAVED_IMAGE = 0x07,
  VIDEO = 0x08,
}

// Communication mode
export enum CommunicationMode {
  SERIAL = 'serial',
  GPRS = 'gprs',
}

// Encoding format
export enum EncodingFormat {
  UNICODE = 0x00,
  GBK = 0x01,
}

// Interfaces for command parameters

export interface MessageOptions {
  address?: number;
  cardType?: number;
  mode?: CommunicationMode;
  cardNumber?: string;
}

export interface PlayVoiceParams {
  content: string;
  playCount?: number;
  encoding?: EncodingFormat;
}

export interface SetClockParams {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

export interface TimePeriod {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface AndroidTimePeriod {
  startTime: number; // hours * 60 + minutes
  endTime: number;
}

export interface TimerSwitchScreenParams {
  enabled?: boolean;
  periods: TimePeriod[] | AndroidTimePeriod[];
  isAndroid?: boolean;
}

export interface BrightnessTimePeriod {
  hour: number;
  minute: number;
  value: number;
}

export interface BrightnessAdjustParams {
  type: 'manual' | 'scheduled';
  value?: number;
  periods?: BrightnessTimePeriod[];
  isAndroid?: boolean;
}

export interface VolumeTimePeriod {
  hour: number;
  minute: number;
  value: number;
}

export interface VolumeAdjustParams {
  type: 'manual' | 'scheduled';
  value?: number;
  periods?: VolumeTimePeriod[];
  isAndroid?: boolean;
}

export interface RelayControlParams {
  relayId: number;
  action: 'open' | 'close' | 'read';
}

export interface RelayTimePeriod {
  startHour: number;
  startMinute: number;
  startSecond: number;
  endHour: number;
  endMinute: number;
  endSecond: number;
  relayMask: number;
  relayValue: number;
}

export interface SetRelayInfoParams {
  actionType: 'manual' | 'scheduled';
  manualRelayMask?: number;
  manualRelayValue?: number;
  periods?: RelayTimePeriod[];
  isAndroid?: boolean;
  enabled?: boolean;
}

export interface ProgramPartition {
  id: number;
  left: number;
  top: number;
  width: number;
  height: number;
  type: PartitionType;
  fontType?: FontType;
  fontColor?: FontColor;
  entryType?: EntryType;
  entrySpeed?: number;
  stayTime?: number;
  content: string;
}

export interface InstantProgramParams {
  programId?: number;
  playType: 'count' | 'duration';
  playValue: number;
  hasVoice?: boolean;
  partitions: ProgramPartition[];
}

export interface ProgramOnDemandParams {
  programId: number;
  action: 'play' | 'stop';
  flag?: 'continuous' | 'single_off' | 'single_normal';
}

export interface TemplateObjectData {
  objectId: number;
  fontSize?: number;
  color?: number | { r: number; g: number; b: number; a?: number };
  entryType?: number;
  content: string;
}

export interface TemplateDisplayParams {
  templateId: number;
  objects: TemplateObjectData[];
  displayMode?: 'full' | 'current_only';
  encoding?: 'unicode' | 'gbk';
}

export interface TableCellData {
  row: number;
  column: number;
  color?: number;
  entryType?: number;
  content: string;
}

export interface TableRowData {
  fields: string[];
}

export interface TableDisplayParams {
  actionType: 'cell' | 'row';
  cells?: TableCellData[];
  rows?: TableRowData[];
}

export interface TemplateWithCursorObjectData {
  objectId: number;
  hasCursor: boolean;
  cursorIndex?: number;
  reverseColor?: boolean;
  content: string;
}

export interface TemplateWithCursorParams {
  templateId: number;
  objects: TemplateWithCursorObjectData[];
  displayMode?: 'full' | 'current_only';
}

// Response types

export interface BaseResponse {
  success: boolean;
  errorCode: number;
  rawData: Buffer;
}

export interface VersionResponse extends BaseResponse {
  protocolId?: number;
  hardwareVersion?: string;
  bootVersion?: string;
  softwareVersion?: string;
  softwareDate?: string;
  applicationType?: number;
  screenWidth?: number;
  screenHeight?: number;
}

export interface SystemVersionResponse extends BaseResponse {
  firmwareMainVersion?: number;
  firmwareSubVersion?: number;
  hardwareMainVersion?: number;
  hardwareSubVersion?: number;
}

export interface BrightnessResponse extends BaseResponse {
  type?: 'manual' | 'scheduled';
  value?: number;
  periods?: BrightnessTimePeriod[];
}

export interface VolumeResponse extends BaseResponse {
  type?: 'manual' | 'scheduled';
  value?: number;
  periods?: VolumeTimePeriod[];
}

export interface RelayInfoResponse extends BaseResponse {
  actionType?: 'manual' | 'scheduled';
  manualRelayMask?: number;
  manualRelayValue?: number;
  periods?: RelayTimePeriod[];
}

export interface ProgramResponse extends BaseResponse {
  programId?: number;
}

export interface TemplateDisplayResponse extends BaseResponse {
  templateId?: number;
  errorObjectIds?: number[];
  errorCodes?: number[];
}

export interface TableDisplayResponse extends BaseResponse {
  rowCount?: number;
  columnCount?: number;
  fieldInfo?: string[];
}

// Transport interface for different communication methods
export interface ITransport {
  write(data: Buffer): Promise<void>;
  read(timeout?: number): Promise<Buffer>;
  close(): Promise<void>;
  isOpen(): boolean;
}
