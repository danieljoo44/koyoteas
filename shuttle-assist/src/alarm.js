// Loud local alarm (macOS): repeats a system sound until silenced.
import { spawn } from 'node:child_process';

let timer = null;

export function startAlarm(spokenMessage) {
  if (timer) return;
  const play = () => {
    spawn('afplay', ['-v', '2', '/System/Library/Sounds/Sosumi.aiff'], { stdio: 'ignore' }).on('error', () => {});
  };
  play();
  if (spokenMessage) {
    spawn('say', [spokenMessage], { stdio: 'ignore' }).on('error', () => {});
  }
  timer = setInterval(play, 1600);
}

export function stopAlarm() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function chirp() {
  spawn('afplay', ['/System/Library/Sounds/Glass.aiff'], { stdio: 'ignore' }).on('error', () => {});
}

export const alarmActive = () => timer !== null;
