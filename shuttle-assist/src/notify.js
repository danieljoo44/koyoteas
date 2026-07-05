// Phone notifications via ntfy.sh or Pushover, selected in config.notify.
export async function sendNotification(notifyCfg, title, message, log) {
  const provider = notifyCfg?.provider;
  try {
    if (provider === 'ntfy') {
      const { server = 'https://ntfy.sh', topic } = notifyCfg.ntfy || {};
      if (!topic || /CHANGE-ME/i.test(topic)) {
        log('notify: ntfy topic not configured — phone notification skipped');
        return false;
      }
      const res = await fetch(`${server.replace(/\/$/, '')}/${topic}`, {
        method: 'POST',
        headers: { Title: title, Priority: 'urgent', Tags: 'rotating_light,bus' },
        body: message,
      });
      log(`notify: ntfy ${res.ok ? 'sent' : `failed (HTTP ${res.status})`} — "${title}"`);
      return res.ok;
    }
    if (provider === 'pushover') {
      const { token, user } = notifyCfg.pushover || {};
      if (!token || !user) {
        log('notify: pushover token/user not configured — phone notification skipped');
        return false;
      }
      const res = await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, user, title, message, priority: 1 }),
      });
      log(`notify: pushover ${res.ok ? 'sent' : `failed (HTTP ${res.status})`} — "${title}"`);
      return res.ok;
    }
    log(`notify: unknown provider "${provider}" — phone notification skipped`);
    return false;
  } catch (e) {
    log(`notify: failed (${e.message})`);
    return false;
  }
}
