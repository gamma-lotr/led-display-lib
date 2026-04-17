/**
 * LGSV1301 Protocol Command Builders
 */

import {
  CommandCode,
  EncodingFormat,
  FontType,
  FontColor,
  EntryType,
  PartitionType,
  PlayVoiceParams,
  SetClockParams,
  TimerSwitchScreenParams,
  BrightnessAdjustParams,
  VolumeAdjustParams,
  RelayControlParams,
  SetRelayInfoParams,
  InstantProgramParams,
  ProgramOnDemandParams,
  TemplateDisplayParams,
  TableDisplayParams,
  TemplateWithCursorParams,
  MessageOptions,
  TimePeriod,
  AndroidTimePeriod,
} from './types';
import {
  buildMessage,
  stringToUnicode,
  stringToGbk,
  writeUInt16LE,
} from './protocol';

/**
 * Build heartbeat command
 */
export function buildHeartbeat(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.HEARTBEAT, Buffer.alloc(0), options);
}

/**
 * Build screen on command
 */
export function buildScreenOn(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.SCREEN_ON, Buffer.alloc(0), options);
}

/**
 * Build screen off command
 */
export function buildScreenOff(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.SCREEN_OFF, Buffer.alloc(0), options);
}

/**
 * Build reset system command
 */
export function buildResetSystem(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.RESET_SYSTEM, Buffer.alloc(0), options);
}

/**
 * Build query version command
 */
export function buildQueryVersion(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.QUERY_VERSION, Buffer.alloc(0), options);
}

/**
 * Build query simple version command (0x4E)
 * Returns a simple version string like "250714TC5102Z"
 */
export function buildQuerySimpleVersion(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.QUERY_SIMPLE_VERSION, Buffer.alloc(0), options);
}

/**
 * Build get system version command
 */
export function buildGetSystemVersion(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.GET_SYSTEM_VERSION, Buffer.alloc(0), options);
}

/**
 * Build query brightness command
 */
export function buildQueryBrightness(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.QUERY_BRIGHTNESS, Buffer.alloc(0), options);
}

/**
 * Build query volume command
 */
export function buildQueryVolume(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.QUERY_VOLUME, Buffer.alloc(0), options);
}

/**
 * Build read relay info command
 */
export function buildReadRelayInfo(options: MessageOptions = {}): Buffer {
  return buildMessage(CommandCode.READ_RELAY_INFO, Buffer.alloc(0), options);
}

/**
 * Build play voice command
 */
export function buildPlayVoice(params: PlayVoiceParams, options: MessageOptions = {}): Buffer {
  const encoding = params.encoding ?? EncodingFormat.UNICODE;
  const playCount = params.playCount ?? 1;

  const contentBuffer =
    encoding === EncodingFormat.UNICODE
      ? stringToUnicode(params.content)
      : stringToGbk(params.content);

  const content = Buffer.alloc(2 + contentBuffer.length);
  content[0] = playCount;
  content[1] = encoding;
  contentBuffer.copy(content, 2);

  return buildMessage(CommandCode.PLAY_VOICE, content, options);
}

/**
 * Build set clock command
 */
export function buildSetClock(params: SetClockParams, options: MessageOptions = {}): Buffer {
  const content = Buffer.alloc(9);

  // Year (little-endian)
  writeUInt16LE(content, params.year, 0);
  content[2] = params.month;
  content[3] = params.day;
  content[4] = params.hour;
  content[5] = params.minute;
  content[6] = params.second;
  content[7] = params.weekday;
  content[8] = 0; // Reserved

  return buildMessage(CommandCode.SET_CLOCK, content, options);
}

/**
 * Build timer switch screen command
 */
export function buildTimerSwitchScreen(
  params: TimerSwitchScreenParams,
  options: MessageOptions = {}
): Buffer {
  if (params.isAndroid) {
    // Android format
    const periods = params.periods as AndroidTimePeriod[];
    const content = Buffer.alloc(2 + periods.length * 4);

    content[0] = params.enabled !== false ? 0x01 : 0x00;
    content[1] = periods.length;

    let offset = 2;
    for (const period of periods) {
      writeUInt16LE(content, period.startTime, offset);
      writeUInt16LE(content, period.endTime, offset + 2);
      offset += 4;
    }

    return buildMessage(CommandCode.TIMER_SWITCH_SCREEN, content, options);
  } else {
    // Non-Android format
    const periods = params.periods as TimePeriod[];
    const content = Buffer.alloc(1 + periods.length * 4);

    content[0] = periods.length;

    let offset = 1;
    for (const period of periods) {
      content[offset] = period.startHour;
      content[offset + 1] = period.startMinute;
      content[offset + 2] = period.endHour;
      content[offset + 3] = period.endMinute;
      offset += 4;
    }

    return buildMessage(CommandCode.TIMER_SWITCH_SCREEN, content, options);
  }
}

/**
 * Build brightness adjustment command
 */
export function buildBrightnessAdjust(
  params: BrightnessAdjustParams,
  options: MessageOptions = {}
): Buffer {
  if (params.isAndroid) {
    // Android format
    if (params.type === 'manual') {
      const content = Buffer.alloc(2);
      content[0] = 0x02; // Manual
      content[1] = params.value ?? 8;
      return buildMessage(CommandCode.BRIGHTNESS_ADJUST, content, options);
    } else {
      const periods = params.periods ?? [];
      const content = Buffer.alloc(2 + periods.length * 5);
      content[0] = 0x01; // Scheduled
      content[1] = periods.length;

      let offset = 2;
      for (const period of periods) {
        const startTime = period.hour * 60 + period.minute;
        writeUInt16LE(content, startTime, offset);
        writeUInt16LE(content, startTime, offset + 2); // End time same as start for point-in-time
        content[offset + 4] = period.value;
        offset += 5;
      }

      return buildMessage(CommandCode.BRIGHTNESS_ADJUST, content, options);
    }
  } else {
    // Non-Android format
    const type = params.type === 'manual' ? 1 : 0;
    const periods = params.periods ?? [];

    if (params.type === 'manual') {
      const content = Buffer.alloc(5);
      content[0] = type;
      content[1] = 1; // Count
      content[2] = 0; // Hour (ignored for manual)
      content[3] = 0; // Minute (ignored for manual)
      content[4] = params.value ?? 8;
      return buildMessage(CommandCode.BRIGHTNESS_ADJUST, content, options);
    } else {
      const content = Buffer.alloc(2 + periods.length * 3);
      content[0] = type;
      content[1] = periods.length;

      let offset = 2;
      for (const period of periods) {
        content[offset] = period.hour;
        content[offset + 1] = period.minute;
        content[offset + 2] = period.value;
        offset += 3;
      }

      return buildMessage(CommandCode.BRIGHTNESS_ADJUST, content, options);
    }
  }
}

/**
 * Build volume adjustment command
 */
export function buildVolumeAdjust(
  params: VolumeAdjustParams,
  options: MessageOptions = {}
): Buffer {
  if (params.isAndroid) {
    // Android format
    if (params.type === 'manual') {
      const content = Buffer.alloc(2);
      content[0] = 0x02; // Manual
      content[1] = params.value ?? 8;
      return buildMessage(CommandCode.VOLUME_ADJUST, content, options);
    } else {
      const periods = params.periods ?? [];
      const content = Buffer.alloc(2 + periods.length * 5);
      content[0] = 0x01; // Scheduled
      content[1] = periods.length;

      let offset = 2;
      for (const period of periods) {
        const startTime = period.hour * 60 + period.minute;
        writeUInt16LE(content, startTime, offset);
        writeUInt16LE(content, startTime, offset + 2);
        content[offset + 4] = period.value;
        offset += 5;
      }

      return buildMessage(CommandCode.VOLUME_ADJUST, content, options);
    }
  } else {
    // Non-Android format
    const type = params.type === 'manual' ? 1 : 0;
    const periods = params.periods ?? [];

    if (params.type === 'manual') {
      const content = Buffer.alloc(5);
      content[0] = type;
      content[1] = 1;
      content[2] = 0;
      content[3] = 0;
      content[4] = params.value ?? 8;
      return buildMessage(CommandCode.VOLUME_ADJUST, content, options);
    } else {
      const content = Buffer.alloc(2 + periods.length * 3);
      content[0] = type;
      content[1] = periods.length;

      let offset = 2;
      for (const period of periods) {
        content[offset] = period.hour;
        content[offset + 1] = period.minute;
        content[offset + 2] = period.value;
        offset += 3;
      }

      return buildMessage(CommandCode.VOLUME_ADJUST, content, options);
    }
  }
}

/**
 * Build relay control command
 */
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
  }

  return buildMessage(CommandCode.RELAY_CONTROL, content, options);
}

/**
 * Build set relay info command
 */
export function buildSetRelayInfo(
  params: SetRelayInfoParams,
  options: MessageOptions = {}
): Buffer {
  if (params.isAndroid) {
    // Android format
    const periods = params.periods ?? [];
    const content = Buffer.alloc(2 + periods.length * 6);

    content[0] = params.enabled !== false ? 0x01 : 0x00;
    content[1] = periods.length;

    let offset = 2;
    for (const period of periods) {
      const startTime =
        period.startHour * 60 + period.startMinute;
      const endTime = period.endHour * 60 + period.endMinute;
      writeUInt16LE(content, startTime, offset);
      writeUInt16LE(content, endTime, offset + 2);
      content[offset + 4] = period.relayMask;
      content[offset + 5] = period.relayValue;
      offset += 6;
    }

    return buildMessage(CommandCode.SET_RELAY_INFO, content, options);
  } else {
    // Non-Android format
    const periods = params.periods ?? [];
    const content = Buffer.alloc(4 + periods.length * 8);

    content[0] = params.actionType === 'manual' ? 0x01 : 0x00;
    content[1] = params.manualRelayMask ?? 0;
    content[2] = params.manualRelayValue ?? 0;
    content[3] = periods.length;

    let offset = 4;
    for (const period of periods) {
      content[offset] = period.startHour;
      content[offset + 1] = period.startMinute;
      content[offset + 2] = period.startSecond;
      content[offset + 3] = period.endHour;
      content[offset + 4] = period.endMinute;
      content[offset + 5] = period.endSecond;
      content[offset + 6] = period.relayMask;
      content[offset + 7] = period.relayValue;
      offset += 8;
    }

    return buildMessage(CommandCode.SET_RELAY_INFO, content, options);
  }
}

/**
 * Build program on demand command
 */
export function buildProgramOnDemand(
  params: ProgramOnDemandParams,
  options: MessageOptions = {}
): Buffer {
  const content = Buffer.alloc(4);

  writeUInt16LE(content, params.programId, 0);
  content[2] = params.action === 'play' ? 0x01 : 0x00;

  let flag = 0;
  switch (params.flag) {
    case 'continuous':
      flag = 0;
      break;
    case 'single_off':
      flag = 1;
      break;
    case 'single_normal':
      flag = 2;
      break;
    default:
      flag = 0;
  }
  content[3] = flag;

  return buildMessage(CommandCode.PROGRAM_ON_DEMAND, content, options);
}

/**
 * Build instant program command
 */
export function buildInstantProgram(
  params: InstantProgramParams,
  options: MessageOptions = {}
): Buffer {
  const partitions = params.partitions;

  // Calculate total content size
  let totalSize = 9; // Program basic info size
  for (const partition of partitions) {
    const textContent = stringToUnicode(partition.content);
    totalSize += 23 + textContent.length; // Partition header + content
  }

  const content = Buffer.alloc(totalSize);
  let offset = 0;

  // Program basic information (9 bytes)
  content[offset++] = 0x00; // Version
  content[offset++] = 0x00; // CmdType (0 = instant)
  writeUInt16LE(content, params.programId ?? 0, offset);
  offset += 2;
  content[offset++] = params.playType === 'count' ? 0x00 : 0x01;
  content[offset++] = params.playValue;
  content[offset++] = params.hasVoice ? 0x01 : 0x00;
  content[offset++] = 0x00; // AreaID (fixed)
  content[offset++] = partitions.length;

  // Partition information
  for (const partition of partitions) {
    const textContent = stringToUnicode(partition.content);
    const partitionContentLength = textContent.length;

    content[offset++] = partition.id; // Area ID number
    writeUInt16LE(content, partitionContentLength, offset);
    offset += 2;
    writeUInt16LE(content, partition.left, offset);
    offset += 2;
    writeUInt16LE(content, partition.top, offset);
    offset += 2;
    writeUInt16LE(content, partition.width, offset);
    offset += 2;
    writeUInt16LE(content, partition.height, offset);
    offset += 2;
    content[offset++] = partition.type ?? PartitionType.TEXT;
    writeUInt16LE(content, 0, offset); // Page index
    offset += 2;
    content[offset++] = partition.fontType ?? FontType.FONT_16X16;
    content[offset++] = partition.fontColor ?? FontColor.RED;
    content[offset++] = partition.entryType ?? EntryType.STATIC;
    content[offset++] = partition.entrySpeed ?? 1;
    content[offset++] = 0; // Out type
    content[offset++] = 0; // Out speed
    content[offset++] = partition.stayTime ?? 0xff; // Stay time (0xFF = always)

    // Content
    textContent.copy(content, offset);
    offset += partitionContentLength;
  }

  return buildMessage(CommandCode.SEND_INSTANT_PROGRAM, content.subarray(0, offset), options);
}

/**
 * Build saved program command (same as instant but different command code)
 */
export function buildSavedProgram(
  params: InstantProgramParams,
  options: MessageOptions = {}
): Buffer {
  const instantMsg = buildInstantProgram(params, options);
  // Change command code from 0x20 to 0x24
  instantMsg[4] = CommandCode.SEND_SAVED_PROGRAM;
  // Recalculate checksum
  const checksumData = instantMsg.subarray(0, instantMsg.length - 2);
  let checksum = 0;
  for (let i = 0; i < checksumData.length; i++) {
    checksum ^= checksumData[i];
  }
  instantMsg[instantMsg.length - 2] = checksum ^ 0xff;
  return instantMsg;
}

/**
 * Build template display command (Unicode - 0xCC)
 */
export function buildTemplateDisplayUnicode(
  params: TemplateDisplayParams,
  options: MessageOptions = {}
): Buffer {
  // Calculate size
  let totalSize = 3; // Template ID + Object count + Display mode
  for (const obj of params.objects) {
    const textContent = stringToUnicode(obj.content);
    totalSize += 5 + textContent.length; // Object header (5) + content
  }

  const content = Buffer.alloc(totalSize);
  let offset = 0;

  content[offset++] = params.templateId;
  content[offset++] = params.objects.length;

  for (const obj of params.objects) {
    const textContent = stringToUnicode(obj.content);

    content[offset++] = obj.objectId;
    content[offset++] = obj.fontSize ?? 0;
    content[offset++] = typeof obj.color === 'number' ? obj.color : 0;
    content[offset++] = obj.entryType ?? 0;
    content[offset++] = textContent.length;
    textContent.copy(content, offset);
    offset += textContent.length;
  }

  content[offset++] = params.displayMode === 'current_only' ? 0x01 : 0x00;

  return buildMessage(CommandCode.TEMPLATE_DISPLAY_UNICODE, content.subarray(0, offset), options);
}

/**
 * Build template display command (GBK - 0xC8)
 */
export function buildTemplateDisplayGbk(
  params: TemplateDisplayParams,
  options: MessageOptions = {}
): Buffer {
  // Calculate size
  let totalSize = 3;
  for (const obj of params.objects) {
    const textContent = stringToGbk(obj.content);
    totalSize += 5 + textContent.length;
  }

  const content = Buffer.alloc(totalSize);
  let offset = 0;

  content[offset++] = params.templateId;
  content[offset++] = params.objects.length;

  for (const obj of params.objects) {
    const textContent = stringToGbk(obj.content);

    content[offset++] = obj.objectId;
    content[offset++] = obj.fontSize ?? 0;
    content[offset++] = typeof obj.color === 'number' ? obj.color : 0;
    content[offset++] = obj.entryType ?? 0;
    content[offset++] = textContent.length;
    textContent.copy(content, offset);
    offset += textContent.length;
  }

  content[offset++] = params.displayMode === 'current_only' ? 0x01 : 0x00;

  return buildMessage(CommandCode.TEMPLATE_DISPLAY_GBK, content.subarray(0, offset), options);
}

/**
 * Build template display with color command (0xC4)
 */
export function buildTemplateDisplayColor(
  params: TemplateDisplayParams,
  options: MessageOptions = {}
): Buffer {
  // Calculate size
  let totalSize = 3;
  for (const obj of params.objects) {
    const textContent = stringToUnicode(obj.content);
    totalSize += 8 + textContent.length; // 4 extra bytes for RGBA color
  }

  const content = Buffer.alloc(totalSize);
  let offset = 0;

  content[offset++] = params.templateId;
  content[offset++] = params.objects.length;

  for (const obj of params.objects) {
    const textContent = stringToUnicode(obj.content);

    content[offset++] = obj.objectId;
    content[offset++] = obj.fontSize ?? 0;

    // Color as 4 bytes (RGBA)
    if (typeof obj.color === 'object') {
      content[offset++] = obj.color.r ?? 255;
      content[offset++] = obj.color.g ?? 0;
      content[offset++] = obj.color.b ?? 0;
      content[offset++] = obj.color.a ?? 255;
    } else {
      content[offset++] = 255; // R
      content[offset++] = 0; // G
      content[offset++] = 0; // B
      content[offset++] = 255; // A
    }

    content[offset++] = obj.entryType ?? 0;
    content[offset++] = textContent.length;
    textContent.copy(content, offset);
    offset += textContent.length;
  }

  content[offset++] = params.displayMode === 'current_only' ? 0x01 : 0x00;

  return buildMessage(CommandCode.TEMPLATE_DISPLAY_COLOR, content.subarray(0, offset), options);
}

/**
 * Build table display command (0xCD)
 */
export function buildTableDisplay(
  params: TableDisplayParams,
  options: MessageOptions = {}
): Buffer {
  if (params.actionType === 'cell' && params.cells) {
    // Cell operation
    let totalSize = 2;
    for (const cell of params.cells) {
      const textContent = stringToUnicode(cell.content);
      totalSize += 5 + textContent.length;
    }

    const content = Buffer.alloc(totalSize);
    let offset = 0;

    content[offset++] = 0x00; // Action type: cell
    content[offset++] = params.cells.length;

    for (const cell of params.cells) {
      const textContent = stringToUnicode(cell.content);

      content[offset++] = cell.row;
      content[offset++] = cell.column;
      content[offset++] = cell.color ?? 0;
      content[offset++] = cell.entryType ?? 0;
      content[offset++] = textContent.length;
      textContent.copy(content, offset);
      offset += textContent.length;
    }

    return buildMessage(CommandCode.TABLE_DISPLAY, content.subarray(0, offset), options);
  } else if (params.actionType === 'row' && params.rows) {
    // Row operation
    const FIELD_SEPARATOR = Buffer.from([0x00, 0x02]); // 0x0002 separator

    // Build row data
    const rowBuffers: Buffer[] = [];
    for (const row of params.rows) {
      const fieldBuffers: Buffer[] = [];
      for (let i = 0; i < row.fields.length; i++) {
        fieldBuffers.push(stringToUnicode(row.fields[i]));
        if (i < row.fields.length - 1) {
          fieldBuffers.push(FIELD_SEPARATOR);
        }
      }
      const rowData = Buffer.concat(fieldBuffers);
      const rowBuffer = Buffer.alloc(2 + rowData.length);
      writeUInt16LE(rowBuffer, rowData.length, 0);
      rowData.copy(rowBuffer, 2);
      rowBuffers.push(rowBuffer);
    }

    const allRowData = Buffer.concat(rowBuffers);
    const content = Buffer.alloc(2 + allRowData.length);
    content[0] = 0x01; // Action type: row
    content[1] = params.rows.length;
    allRowData.copy(content, 2);

    return buildMessage(CommandCode.TABLE_DISPLAY, content, options);
  }

  return buildMessage(CommandCode.TABLE_DISPLAY, Buffer.alloc(0), options);
}

/**
 * Build template with cursor command (0xCE)
 */
export function buildTemplateWithCursor(
  params: TemplateWithCursorParams,
  options: MessageOptions = {}
): Buffer {
  // Calculate size
  let totalSize = 3;
  for (const obj of params.objects) {
    const textContent = stringToUnicode(obj.content);
    totalSize += 4 + textContent.length;
  }

  const content = Buffer.alloc(totalSize);
  let offset = 0;

  content[offset++] = params.templateId;
  content[offset++] = params.objects.length;

  for (const obj of params.objects) {
    const textContent = stringToUnicode(obj.content);

    content[offset++] = obj.objectId;

    // Cursor info
    let cursorFlag = 0;
    if (obj.hasCursor) {
      cursorFlag = obj.reverseColor ? 0x02 : 0x01;
    }
    content[offset++] = cursorFlag;
    content[offset++] = obj.cursorIndex ?? 0;
    content[offset++] = textContent.length;
    textContent.copy(content, offset);
    offset += textContent.length;
  }

  content[offset++] = params.displayMode === 'current_only' ? 0x01 : 0x00;

  return buildMessage(CommandCode.TEMPLATE_WITH_CURSOR, content.subarray(0, offset), options);
}
