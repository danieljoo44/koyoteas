export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function jitterMs(minMs, maxMs) {
  return Math.round(minMs + Math.random() * (maxMs - minMs));
}

// Small human-plausible pause between UI actions.
export async function humanPause(min = 350, max = 900) {
  await sleep(jitterMs(min, max));
}
