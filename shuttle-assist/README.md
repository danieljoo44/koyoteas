# shuttle-assist

Personal reservation assist for the **Parks Canada Lake Louise / Moraine Lake shuttle**
(reservation.pc.gc.ca). It gets you from "slots just opened" to the checkout page as
fast as a polite, human-paced browser session can, then **stops and hands the wheel to
you**. You complete sign-in and payment yourself.

Built for one person, one reservation, on your own machine.

## What was verified against the live site (2026-07-05)

- **Release rule** (confirmed by the site's own error message, not just docs): seats for
  a given arrival date open **2 days before at 8:00 a.m. Mountain / 10:00 a.m. Eastern**
  ("These dates cannot be reserved until \<date\> at 10:00 a.m. EDT"). For the
  pre-configured target of **Sun July 13, 2026** that is **Sat July 11, 10:00 a.m. EDT**.
- **Slot naming** on the results list (List view):
  - `4am Alpine Start Departure`, `5am Alpine Start Departure`
  - `6:30am-7am Departures`, `7am-8am Departures`, … hourly … `4pm-5pm Departures`
- Inside a slot, rows per destination: `Lake Louise: 6:30am-7am`,
  `Moraine Lake: 6:30am-7am`, `Alpine Start - Moraine Lake: 5am`, each with a
  **`(Last Minute)`** twin — that twin is the bucket the 2-day rolling release fills.
- Reserve path: click Available cell → **Reserve** button → "Park Alerts" dialog
  (**Acknowledge**) → item is **held in cart** → "Review Reservation Details" page.
- Cart holds last roughly **20 minutes**, and a held item **silently blocks further
  Reserve clicks** — which is why warm-up refuses to start if your cart isn't empty.

### ⚠️ About the "5:00 am departure"

There is **no 5:00 am regular Lake Louise shuttle** — regular shuttles from the Park
and Ride run **6:30 a.m. to 5 p.m.** The only 5 a.m. slot is the **Alpine Start**
(`5am Alpine Start Departure`), which:

- goes to **Moraine Lake** (sunrise shuttle), connecting back to Lake Louise later via
  the Lake Connector, and
- departs from the **Lake Louise Lakeshore parking lot**, not the Park and Ride —
  you must drive up and pay for parking there in the middle of the night.

The pre-filled config books the 5am Alpine Start first, then falls back to the
earliest regular departures (6:30am-7am, 7am-8am, …). **If you actually want the
regular Park-and-Ride shuttle, delete the Alpine line from `slotPriority`.**

## Setup (once)

```bash
cd shuttle-assist
export PATH="$HOME/.local/node/bin:$PATH"   # node lives here on this machine
npm install                                  # already done if node_modules/ exists
```

Uses your installed Google Chrome (visible window) via playwright-core — nothing else
to download. A dedicated Chrome profile is kept in `.profile/` so your Parks Canada
login survives between runs (your password is never seen or stored by the tool).

**Phone notifications:** the config ships with ntfy topic `lls-daniel-7k3v9q2mrx`.
Install the ntfy app (iOS/Android), subscribe to that topic, then:

```bash
node src/index.js test-alert     # rings the mac + pings your phone
```

(Pushover instead: set `notify.provider` to `"pushover"` and fill in token/user.)

## Configuration (`config.json`)

| key | meaning |
|---|---|
| `targetDate` | arrival date, `YYYY-MM-DD` (pre-set: `2026-07-13`) |
| `partySize` | number of passengers (pre-set: 2) |
| `slotPriority` | ordered list of slot labels to try, exactly as the site names them |
| `destinationPriority` | which row to prefer inside a slot; rows matching neither are never booked. Keep `"Moraine Lake"` listed if you keep the Alpine Start in `slotPriority` (it's a Moraine row). |
| `fallbackToEarliest` | after `slotPriority`, try remaining regular slots earliest-first (never Alpine unless listed) |
| `release` | `daysBefore: 2`, `time: "08:00"`, `timezone: "America/Edmonton"` — release day is computed from `targetDate` automatically |
| `warmupMinutes` | how long before release the browser opens for login/pre-positioning (12) |
| `pollSeconds*` | polling cadence, randomized between min/max (2.5–4.5 s; min ≥ 2 s is enforced) |
| `pollMaxMinutes` | give up + alarm after this long with no availability (30) |
| `advancePastReview` | after the hold, also tick "details are correct" + click "Confirm reservation details" so you land one page closer to payment (true) |

## Rehearsal (do this before July 11)

Pick a date that still has open seats (late-September/October weekdays usually do —
verify by searching the site manually), then:

```bash
node src/index.js dry-run --date=2026-10-07
```

- Runs the full warm-up → poll → select flow against the real site.
- **Stops right before the Reserve click** — it takes nothing, holds nothing.
- Expected ending: `DRY RUN SUCCESS: "<row>" is selectable and the Reserve button is up`.
- `--armed` makes the rehearsal actually click Reserve and land on the review page —
  that **holds a real seat in the cart**; either complete it (you'd be buying a real
  ticket) or just close and let the hold expire. Use once, at most.
- `--no-login` skips the sign-in prompt.

Every run writes timestamped logs + screenshots to `runs/<time>-<label>/` — if a
selector ever misbehaves, that's where you see exactly what the page looked like.

## The real morning (July 11)

```bash
node src/index.js login    # optional, the evening before: sign in once, press q
node src/index.js run      # start ~9:30 AM EDT or earlier; it waits by itself
```

Timeline the tool runs on (all times computed fresh, NTP-checked, so your Mac's clock
being off doesn't matter):

1. **9:48 AM EDT** (12 min before): Chrome opens, you're prompted to **sign in
   manually** (skipped if the saved session is still live), then it pre-fills
   everything — date July 13, party of 2, list view, top slot's table open.
2. **10:00:00 AM EDT**: starts polling every 2.5–4.5 s (randomized). The instant the
   gate lifts, it clicks the best available row per your priorities → Reserve →
   Acknowledge → **held in cart**.
3. **Handoff**: mac alarm loops + phone notification fires the moment the hold is
   secured. You finish sign-in confirmation/payment in the same window. The hold is
   time-limited — move quickly.

### Your two manual jobs

1. **Log in** during warm-up (tool never touches credentials).
2. **Pay** at the end (tool never touches payment or personal fields).

### Keys while it runs

| key | effect |
|---|---|
| `p` | PAUSE / resume all automation instantly |
| `s` | extra screenshot |
| any key | silence the alarm |
| `q` | quit — **only after you've finished in the browser; quitting closes Chrome** |

### It will stop and alert you (never act) when it sees

- a CAPTCHA, a virtual waiting room / queue,
- a page that doesn't match what it expects,
- the checkout/review page (that's the goal),
- nothing bookable after `pollMaxMinutes`.

### One and done

Reaching the cart writes `state.json`; further `run`s refuse to start. If a run
genuinely failed and you need another attempt, `node src/index.js run --reset`.

## Troubleshooting

- **"state.json says a run already reached…"** — see above; `--reset` after a failed run.
- **Alarm but no phone ping** — re-run `test-alert`; check the ntfy app is subscribed
  to the exact topic in `config.json`.
- **Selector errors in a dry run** — the site changed; look at the latest
  `runs/…/` screenshots and adjust the labels in `slotPriority` / `src/flow.js`.
- **Chrome died mid-checkout** — your cart lives on the server: open Chrome normally,
  go to reservation.pc.gc.ca, sign in, open the Cart. The hold keeps ticking, so hurry.
- **Queue-it waiting room at 10:00** — the tool parks and alarms; sit through the queue
  in the window yourself, then press `p` twice (pause/resume) once you're back on the
  results page to let it continue.

## Conduct notes (please keep it this way)

Automated interaction with the reservation site may be against its terms of use even
at human speed — this tool deliberately stays modest (2.5–4.5 s polling ≈ an anxious
human with a refresh finger), takes exactly one reservation, never touches CAPTCHAs,
queues, or payment, and never holds inventory it doesn't intend to buy. Don't loosen
those settings; don't run more than one instance; don't use it to grab slots to resell.
