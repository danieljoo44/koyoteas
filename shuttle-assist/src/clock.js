// Clock sync: how far off is the system clock from true time?
// Primary: SNTP (UDP 123). Fallback: HTTPS Date header (~±1s, good enough
// for a poll cadence measured in seconds).
import dgram from 'node:dgram';

const NTP_EPOCH_DELTA = 2208988800; // seconds between 1900-01-01 and 1970-01-01

function sntpOffsetMs(host, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const packet = Buffer.alloc(48);
    packet[0] = 0x1b; // LI=0 VN=3 Mode=3 (client)
    const t0 = Date.now();
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('timeout'));
    }, timeoutMs);
    socket.once('error', (err) => {
      clearTimeout(timer);
      try { socket.close(); } catch {}
      reject(err);
    });
    socket.once('message', (msg) => {
      const t3 = Date.now();
      clearTimeout(timer);
      socket.close();
      if (msg.length < 48) return reject(new Error('short packet'));
      const secs = msg.readUInt32BE(40);
      const frac = msg.readUInt32BE(44);
      const serverMs = (secs - NTP_EPOCH_DELTA) * 1000 + Math.round((frac / 2 ** 32) * 1000);
      resolve(serverMs - (t0 + t3) / 2);
    });
    socket.send(packet, 0, 48, 123, host, (err) => {
      if (err) {
        clearTimeout(timer);
        try { socket.close(); } catch {}
        reject(err);
      }
    });
  });
}

async function httpDateOffsetMs() {
  const t0 = Date.now();
  const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-store' });
  const t3 = Date.now();
  const d = res.headers.get('date');
  if (!d) throw new Error('no Date header');
  // Date header is truncated to the second; +500ms centers the estimate.
  return new Date(d).getTime() + 500 - (t0 + t3) / 2;
}

// Returns { offsetMs, source }. trueNow() = Date.now() + offsetMs.
export async function syncClock(log) {
  for (const host of ['time.google.com', 'time.cloudflare.com', 'pool.ntp.org']) {
    try {
      const samples = [];
      for (let i = 0; i < 3; i++) samples.push(await sntpOffsetMs(host));
      samples.sort((a, b) => a - b);
      const offsetMs = samples[1];
      log(`clock sync (NTP ${host}): system clock is ${offsetMs >= 0 ? 'behind' : 'ahead'} by ${Math.abs(Math.round(offsetMs))} ms`);
      return { offsetMs, source: `ntp:${host}` };
    } catch (e) {
      log(`NTP ${host} failed: ${e.message}`);
    }
  }
  try {
    const offsetMs = await httpDateOffsetMs();
    log(`clock sync (HTTPS Date header): offset ~${Math.round(offsetMs)} ms (±1s precision)`);
    return { offsetMs, source: 'https-date' };
  } catch (e) {
    log(`WARNING: all clock sync methods failed (${e.message}); assuming system clock is exact.`);
    return { offsetMs: 0, source: 'system' };
  }
}
