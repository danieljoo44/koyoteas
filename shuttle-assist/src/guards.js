// Hard-stop detection. The tool NEVER tries to get past any of these — it
// stops and alerts the human instead.
export async function classifyPage(page) {
  const url = page.url();
  if (/queue-?it\.net/i.test(url) || /\bqueue\b/i.test(new URL(url).hostname)) {
    return { kind: 'queue', detail: `url: ${url}` };
  }

  let text = '';
  try {
    text = (await page.evaluate(() => document.body?.innerText || '')).slice(0, 12000);
  } catch {
    return { kind: 'unknown', detail: 'page not readable' };
  }

  if (/waiting room|virtual queue|you are now in line|your estimated wait|people ahead of you/i.test(text)) {
    return { kind: 'queue', detail: 'waiting-room text on page' };
  }

  try {
    const captchaEl = await page
      .locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .g-recaptcha, .h-captcha')
      .count();
    if (captchaEl > 0) return { kind: 'captcha', detail: 'captcha widget present' };
  } catch {}
  if (/\bcaptcha\b|not a robot|human verification|verify you are human/i.test(text)) {
    return { kind: 'captcha', detail: 'captcha text on page' };
  }

  if (text.replace(/\s+/g, '').length < 200 && /error|unavailable|went wrong/i.test(text)) {
    return { kind: 'error', detail: `sparse error page: ${text.slice(0, 200)}` };
  }

  return { kind: 'ok', detail: '' };
}
