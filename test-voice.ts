import { playVoice, setVolume } from './src';  // or from '@gamma-lotr/led-display-lib'

const HOST = '172.18.60.180';
const PORT = 9005;
const CARD_NUMBER = '00000000000000';

async function test() {
  await setVolume(HOST, PORT, CARD_NUMBER, 3);
  await playVoice(HOST, PORT, CARD_NUMBER, '欢迎光临', { playCount: 1 });
}

test();