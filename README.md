# @gamma-lotr/led-display-lib

A complete Node.js library to control LED displays using the **LGSV1301** protocol over UDP.  
Built for parking systems, digital signage, and real‑time information displays.

## Features

- 🅿️ **Parking System** – Shows current time and date, listens for UDP messages to display a car licence plate on a dedicated row, then auto‑reverts after a configurable delay.
- 🔌 **Screen On/Off** – Remotely turn the LED screen on or off.
- 🧹 **Clear Screen** – Send a blank program to hide all content (requires parking system to be stopped first).
- ⚙️ **Fully Configurable** – Customise row texts, colours, entry effects, screen dimensions, time/date formats, and more.
- 📦 **TypeScript Ready** – Includes type definitions.

## Installation

```bash
npm install @gamma-lotr/led-display-lib

```typescript
import { startParkingSystem, screenOn, screenOff, clearScreen } from '@gamma-lotr/led-display-lib';

// 1. Start the parking system
const parking = startParkingSystem({
  screenHost: '172.18.60.180',   // your LED screen IP
  cardNumber: '13061913001',
});

// 2. Later, stop the parking system
parking.stop();

// 3. Basic screen control
await screenOn('172.18.60.180', 9005, '13061913001');
await screenOff('172.18.60.180', 9005, '13061913001');
await clearScreen('172.18.60.180', 9005, '13061913001');
```

## API Reference

### startParkingSystem(config: ParkingConfig): ParkingInstance

Initialises the parking system. The LED screen will display four rows:

| Row | Default content | Behaviour |
| --- | --- | --- |
| 1 | "Welcome" | Static welcome message |
| 2 | "Car Parking" | Shows car plate when received; auto‑reverts |
| 3 | Current time | Updates every minute (format HH:MM) |
| 4 | Current date | Updates daily (format YYYY-MM-DD) |

The function also starts a UDP server on the configured listenPort (default 9006) that listens for car plates. Any received UDP message (UTF‑8 text) will be displayed on row 2 for the specified duration, then revert to the default text.

### ParkingConfig

| Property | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| screenHost | string | Yes | – | IP address of the LED screen |
| screenPort | number | No | 9005 | UDP port of the screen |
| listenPort | number | No | 9006 | Local UDP port to listen for car plates |
| cardNumber | string | No | '13061913001' | 12‑character card number of the device |
| carPlateDisplayMs | number | No | 10000 | How long (ms) to show the plate before reverting |
| screenWidth | number | No | 64 | Width of the LED screen in pixels |
| screenHeight | number | No | 64 | Height of the LED screen in pixels |
| rowHeight | number | No | 16 | Height of each text row in pixels (font size) |
| timeFormat | string | No | 'HH:MM' | Format for the time row. Supports HH (hours) and MM (minutes) |
| dateFormat | string | No | 'YYYY-MM-DD' | Format for the date row. Supports YYYY, MM, DD |
| rowTexts | string[] | No | ['Welcome', 'Car Parking', '00:00', '2025-01-01'] | Custom text for rows 1‑4 (order: row1, row2, row3, row4) |
| rowColors | number[] | No | [0, 2, 1, 2] | Colour codes for each row. 0=red, 1=green, 2=yellow |
| rowEntryTypes | EntryType[] | No | [0, 2, 0, 2] | Entry animation: 0=static, 2=scroll right |
| rowEntrySpeeds | number[] | No | [0, 5, 0, 5] | Speed of entry effect (0‑255, lower = faster) |

### Returns

ParkingInstance – an object with one method:

stop(): void – Stops the time/date updater, closes the UDP listener, and cancels any pending car‑plate timeout.

### screenOn(host: string, port: number, cardNumber?: string): Promise<void>

Turns the LED screen on.

host – IP address of the LED screen.

port – UDP port (usually 9005).

cardNumber – Optional 12‑character card number (default '13061913001').

### clearScreen(host: string, port: number, cardNumber?: string): Promise<void>

Sends an empty program to the screen, making it blank.

⚠️ Important: If the parking system is running, it will continuously rewrite the display. You must call parking.stop() before clearScreen() for the screen to stay blank.

Parameters are the same as screenOn.

### Sending a Car Plate to the Parking System

Once startParkingSystem() is called, the library listens for UDP messages on the configured listenPort (default 9006). Any text received will be displayed on row 2.

Example using netcat (Linux/macOS)

```bash
echo -n "ABC-1234" | nc -u <ip_of_your_app_machine> 9006
```

Example using PowerShell (Windows)

```powershell
$udp = New-Object System.Net.Sockets.UdpClient
$bytes = [System.Text.Encoding]::UTF8.GetBytes("XYZ-9876")
$udp.Send($bytes, $bytes.Length, "127.0.0.1", 9006)
$udp.Close()
```

The plate will appear on the LED screen for the duration specified in carPlateDisplayMs (default 10 seconds) and then revert to the original text ("Car Parking").

### Integration with NestJS

Here's a complete example of a NestJS controller that exposes HTTP endpoints for your display.

```typescript
// display.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { startParkingSystem, screenOn, screenOff, clearScreen } from '@gamma-lotr/led-display-lib';

let parkingInstance: any = null;

@Controller('display')
export class DisplayController {
  @Get('parking/start')
  startParking() {
    if (parkingInstance) parkingInstance.stop();
    parkingInstance = startParkingSystem({
      screenHost: '172.18.60.180',
      cardNumber: '13061913001',
    });
    return { message: 'Parking system started' };
  }

  @Get('parking/stop')
  stopParking() {
    if (parkingInstance) {
      parkingInstance.stop();
      parkingInstance = null;
    }
    return { message: 'Parking system stopped' };
  }

  @Get('on')
  async turnOn() {
    await screenOn('172.18.60.180', 9005, '13061913001');
    return { message: 'Screen on' };
  }

  @Get('off')
  async turnOff() {
    await screenOff('172.18.60.180', 9005, '13061913001');
    return { message: 'Screen off' };
  }

  @Get('clear')
  async clear() {
    if (parkingInstance) {
      parkingInstance.stop();
      parkingInstance = null;
    }
    await clearScreen('172.18.60.180', 9005, '13061913001');
    return { message: 'Screen cleared' };
  }
}
```

Then register the controller in your module and run the app. Use any HTTP client (curl, Postman, browser) to test:

```bash
curl http://localhost:3000/display/parking/start
curl http://localhost:3000/display/clear
curl http://localhost:3000/display/on
```

### Requirements

Node.js 16 or higher

The LED screen must support the LGSV1301 protocol in GPRS mode (UDP).

The screen’s IP address and 12‑digit card number must be known.

Network connectivity between your application and the screen (UDP port 9005 by default).

### Troubleshooting

| Issue | Possible Solution |
| :--- | :--- |
| Screen does not turn on/off | Check that the screen’s IP and card number are correct. Ensure UDP port 9005 is reachable. |
| Car plate not showing | Verify that the parking system is started (parking/start). Make sure the UDP packet is sent to the same machine running the library, on port 9006 (or your custom listenPort). |
| Clear screen does nothing | The parking system is probably still running. Call parking.stop() first. |
| Time/date not updating | The device’s internal clock may be off. The library automatically sends a clock set command on start. If that fails, check that the screen accepts clock commands. |

### License
MIT