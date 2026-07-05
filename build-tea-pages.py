#!/usr/bin/env python3
"""Generate koyo-site/tea/*.html product pages from one template.

Run from anywhere:  python3 build-tea-pages.py
To add a tea: add an entry to TEAS below and re-run.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "koyo-site", "tea")

TEAS = {
    "sejak": {
        "number": "01",
        "name": "Sejak",
        "kr": "세작",
        "type_line": "GREEN TEA · SINGLE ORIGIN",
        "title": "Sejak 세작 — Single-Origin Korean Green Tea | Koyo",
        "description": "Premium Korean sejak green tea, hand-picked in late April in Hadong, South Korea. Soft, balanced, fresh, steeping to light gold and jade.",
        "lede": "In Korea, they say the morning dew from spring rain is so pure it glistens like treasure. Sejak is crafted to capture the fresh aroma of those mid-April showers: young leaves plucked while still curled.",
        "data_rows": [
            ("ORIGIN", "Hadong, South Korea"),
            ("HARVEST", "Late April, second flush"),
            ("NOTES", "Soft · Balanced · Fresh"),
            ("SERVING", "1 g per 148 ml (5 oz)"),
            ("WATER", "74°C / 165°F, mineral"),
            ("STEEP", "1 minute, then 2, then 4"),
        ],
        "story": [
            "In Korea, there is a saying that the morning dew from spring rain is so pure, it glistens like treasure. <em>Sejak</em> (세작), a Korean-style green tea, is crafted to capture the fresh aromas of these mid-April rain showers: the second flush, plucked while the young leaves are still slightly curled.",
            "Our Sejak comes from Hadong (하동), South Korea, a region renowned for producing premium tea since the ninth century: favorable climate, ideal terrain, and generations of locals nurturing the land. When steeped, it reveals a subtle color between light gold and jade green: a clean taste and delicate hue that bring clarity and balance, reminiscent of the peace found in nature.",
            "Regarded as a premium grade in Korea, every batch is hand-picked and hand-sorted so that no stray leaf makes the cut. The care shows in the cup. What Korean tea culture prizes above all is the plant's own essence, intact.",
        ],
        "brew_steps": [
            ("一", "Warm", "Bring mineral water just past the pearl-bubble point, then let it rest until it cools to 74°C."),
            ("二", "Steep", "One gram of leaves to 148 ml of water. One quiet minute. Watch the gold and jade arrive."),
            ("三", "Return", "Steep again for two minutes, and a third time for four. Drink in small increments, from a small vessel."),
        ],
        "benefits": [
            "Rich in plant-based polyphenol antioxidants with anti-inflammatory values",
            "Boosts metabolism and supports brain health",
            "Moderate caffeine with L-theanine, which may support cognitive function and relaxation at once",
            "Contains calcium, iron, and potassium",
            "A gentle palate that clears the mind, the heart of Korean green tea culture",
        ],
        "price_loose": 33,
        "price_sachet": 14,
        "region": "Hadong",
        "region_note": "TEA COUNTRY SINCE THE 9TH C.",
        "keeping": "Sejak celebrates freshness. Enjoy within two years, while the spring is still in the leaf.",
        "keeping_tip": "STORE COOL &amp; DARK — THE FREEZER KEEPS IT BRIGHTEST",
        "related": ["artemisia", "hwangto"],
    },
    "artemisia": {
        "number": "02",
        "name": "Artemisia",
        "kr": "쑥차",
        "type_line": "TISANE · CAFFEINE-FREE",
        "title": "Artemisia 쑥차 — Wild Korean Mugwort Tisane | Koyo",
        "description": "Wild Korean artemisia (ssuk) tisane, hand-gathered on the lower hills of Jirisan. Smooth, herbal, nutty. Caffeine-free warmth and rest.",
        "lede": "Wild ssuk, hand-gathered on the lower hills of Jirisan. The sacred herb of Korean myth, treasured for over a millennium for warmth, calm, and rest.",
        "data_rows": [
            ("ORIGIN", "Jirisan, South Korea"),
            ("HARVEST", "Wild, gathered by hand"),
            ("NOTES", "Smooth · Herbal · Nutty"),
            ("SERVING", "1 g per 210 ml (7 oz)"),
            ("WATER", "100°C / 212°F, mineral"),
            ("STEEP", "2 minutes, steeps twice"),
        ],
        "story": [
            "Koyo's Artemisia Tea is crafted from <em>artemisia princeps</em>, Korean mugwort, or <em>ssuk</em> (쑥), gathered wild in the lower hills of Jirisan (지리산), a region renowned for the quality of its herbs and vegetation. Its name traces to Artemis, the Greek goddess of nature and fertility, symbolizing a connection to life itself.",
            "That connection runs deep in Korea. In the founding myth, ssuk was one of the two ingredients given to create the first Korean human. In traditional medicine it has been treasured for over a millennium: for warming the body's core, easing cramps, treating colds and fevers, and nurturing restful sleep.",
            "To this day artemisia is drunk across Korea. Ours is hand-gathered from the wilderness rather than farmed. Each spring it comes from the same hills that have supplied Korean healers for centuries.",
        ],
        "brew_steps": [
            ("一", "Boil", "Bring mineral water to a full boil. Artemisia opens best at 100°C."),
            ("二", "Steep", "One gram of leaves to 210 ml of water. Two unhurried minutes."),
            ("三", "Return", "Steep a second time. The herb softens, and the nuttiness comes forward."),
        ],
        "benefits": [
            "Contains vitamins A and C",
            "Anti-inflammatory, antibacterial, and antifungal properties",
            "Traditionally used to improve blood circulation and metabolism",
            "Traditionally used to reduce anxiety, fatigue, and stress",
            "Warms the body's core, long used against colds and fevers",
            "May promote deeper, more restful sleep",
        ],
        "price_loose": 34,
        "price_sachet": 14,
        "region": "Jirisan",
        "region_note": "WILD — GATHERED, NOT FARMED",
        "keeping": "Artemisia keeps its calm a long while. Enjoy within two years.",
        "keeping_tip": "STORE COOL &amp; DARK — ENJOY WITHIN TWO YEARS",
        "related": ["sejak", "persimmon"],
    },
    "persimmon": {
        "number": "03",
        "name": "Persimmon Leaf",
        "kr": "감잎차",
        "type_line": "TISANE · CAFFEINE-FREE",
        "title": "Persimmon Leaf 감잎차 — Rare Spring Tisane | Koyo",
        "description": "Young persimmon leaf tisane, hand-picked in Hadong during a single week each spring. Earthy, bright, dry, and rich in vitamin C.",
        "lede": "Tender spring leaves picked at precisely the right moment. The harvest window lasts a single week, making true persimmon leaf tea a rare and treasured gift of the season.",
        "data_rows": [
            ("ORIGIN", "Hadong, South Korea"),
            ("HARVEST", "Early spring, one week only"),
            ("NOTES", "Earthy · Bright · Dry"),
            ("SERVING", "1 g per 210 ml (7 oz)"),
            ("WATER", "74°C — boiled, then rested"),
            ("STEEP", "2 minutes, steeps twice"),
        ],
        "story": [
            "Persimmons have long been symbols of transformation and resilience. Their trees endure into early winter, bearing fruit through the cold, then sprout back to life with fresh leaves in early spring. We believe the finest persimmon leaf tea comes from these tender new leaves, while their flavor is vibrant, before they grow large, turn bitter, and lose their vitality.",
            "There is a quiet chemistry to that timing: the young leaves hold their full store of nutrients only until the tree diverts them to bear fruit. Picked at the right moment, persimmon leaf is a quiet powerhouse: more vitamin C than a lemon, with magnesium and a broad spectrum of antioxidants.",
            "To capture this fleeting essence, our leaves are hand-picked in Hadong (하동) at precisely the right moment each year. That window can last no more than a week, making true persimmon leaf tea a rare and treasured gift of the season.",
        ],
        "brew_steps": [
            ("一", "Rest", "Boil mineral water fully, then let it rest until it cools to 74°C — gentleness preserves the vitamin C."),
            ("二", "Steep", "One gram of leaves to 210 ml of water. Two quiet minutes."),
            ("三", "Return", "Steep once more. The second cup turns brighter, almost citrus-clean."),
        ],
        "benefits": [
            "More vitamin C than a lemon, with a high magnesium content",
            "Rich in tannins and flavonoids traditionally credited with slowing the aging process",
            "Broad antioxidant spectrum: carotenoids, triterpenoids, proanthocyanidins, quercetin, gallic acid",
            "Anti-inflammatory properties that support joint health",
            "Traditionally used to help with hypertension and blood circulation",
        ],
        "price_loose": 39,
        "price_sachet": 14,
        "region": "Hadong",
        "region_note": "ONE HARVEST WEEK A YEAR",
        "keeping": "Like Sejak, persimmon leaf celebrates freshness. Enjoy within two years of harvest.",
        "keeping_tip": "STORE COOL &amp; DARK — THE FREEZER KEEPS IT BRIGHTEST",
        "related": ["hwangto", "sejak"],
    },
    "hwangto": {
        "number": "04",
        "name": "Hwangto",
        "kr": "황토",
        "type_line": "BLEND · RED TEA & QUINCE",
        "title": "Hwangto 황토 — Korean Red Tea & Quince Blend | Koyo",
        "description": "A Korean red tea (hongcha) and yellow quince blend from Hadong. Gentle warmth, less caffeine, and a softer, sweeter cup.",
        "lede": "Named for hwangto, the \u201cliving soil\u201d of traditional Korean homes. A blend of Korean-style red tea and yellow quince, made to warm you from within.",
        "data_rows": [
            ("ORIGIN", "Hadong, South Korea"),
            ("BLEND", "Hongcha 홍차 & quince 모과"),
            ("NOTES", "Earthy · Bright · Dry"),
            ("SERVING", "3 g per 210 ml (7 oz)"),
            ("WATER", "100°C / 212°F, mineral"),
            ("STEEP", "2 minutes, steeps twice"),
        ],
        "story": [
            "Hwangto (황토) is a yellow-red clay that Koreans call <em>living soil</em>. Said to breathe with the earth, purifying the air while harmonizing the force that brings life, it formed the walls and floors of traditional homes, <em>hanok</em> (한옥), standing as a quiet, enduring cornerstone of Korean culture. We honor that foundation with a blend that unites Korean-style red tea, <em>hongcha</em> (홍차), and yellow quince fruit, <em>mogwa</em> (모과).",
            "Our red tea is made from the same Hadong plants as our Sejak, fully oxidized in the manner of black tea. It brews to a softer crimson, with less caffeine and a sweeter profile, known for gently insulating the drinker from within. The craft behind it draws on both Korean and Taiwanese techniques, refined in small organic batches and hand-picked so those subtle differences stay in the cup.",
            "The quince carries its own legacy: traditionally used to soothe sore throats and dry coughs, a fruit of respiratory healing. Though no longer central to daily life, quince trees still grace Korean courtyards as quiet symbols of strength and purity, much like hwangto itself: ever-present, often unnoticed, deeply rooted.",
        ],
        "brew_steps": [
            ("一", "Boil", "Bring mineral water to a full boil. The blend opens at 100°C."),
            ("二", "Steep", "Three grams to 210 ml of water. Two minutes, and the crimson arrives."),
            ("三", "Return", "Steep once more. The quince sweetens as the red tea softens."),
        ],
        "benefits": [
            "Packed with vitamin C and antioxidants: polyphenols, theaflavins, and thearubigins",
            "Antibacterial and anti-inflammatory properties",
            "Quince has long supported the immune system and digestion",
            "Traditionally used to soothe sore throats and dry coughs",
            "Moderate caffeine with L-theanine, and gentle, warm alertness",
        ],
        "price_loose": 37,
        "price_sachet": 14,
        "region": "Hadong",
        "region_note": "SAME GARDENS AS OUR SEJAK",
        "keeping": "Enjoy within two years. Fully oxidized, hwangto only <em>deepens</em> along the way.",
        "keeping_tip": "STORE COOL &amp; DARK — ENJOY WITHIN TWO YEARS",
        "related": ["sejak", "artemisia"],
    },
}

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>%%TITLE%%</title>
  <meta name="description" content="%%DESCRIPTION%%" />
  <meta property="og:title" content="%%TITLE%%" />
  <meta property="og:description" content="%%DESCRIPTION%%" />
  <meta property="og:type" content="product" />
  <meta property="og:image" content="../assets/img/cup-%%ID%%.jpg" />
  <link rel="icon" type="image/png" href="../assets/img/favicon.png" />
  <script>document.documentElement.classList.add("js");</script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@200;300;400&family=Jost:ital,wght@0,300;0,400;0,500;1,300&family=IBM+Plex+Mono:wght@300;400&display=swap" rel="stylesheet" />

  <link rel="stylesheet" href="../css/style.css" />

  <script type="importmap">
    { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js"></script>
  <script src="../js/shop-config.js"></script>
</head>
<body>

  <!-- Atmosphere -->
  <canvas id="mist-canvas" aria-hidden="true"></canvas>
  <div class="grain" aria-hidden="true"></div>
  <div class="cursor" id="cursor" aria-hidden="true"><span class="cursor-dot"></span></div>

  <!-- Navigation -->
  <header class="nav is-scrolled" id="nav">
    <a class="nav-brand" href="../index.html" data-cursor>
      <img src="../assets/img/koyo-mark-ink.png" alt="Koyo mark" class="nav-mark" />
      <span class="nav-word">KOYO</span>
    </a>
    <nav class="nav-links" aria-label="Primary">
      <a href="../index.html" data-cursor>Home</a>
      <a href="../index.html#specimen" data-cursor>Collection</a>
      <a href="../index.html#ethos" data-cursor>Story</a>
      <a href="../index.html#ritual" data-cursor>Ritual</a>
      <div class="nav-shop">
        <a href="../shop.html" data-cursor aria-haspopup="true">Shop</a>
        <div class="nav-dropdown" aria-label="Teas">
          <a href="sejak.html" data-cursor>Sejak <span>세작</span></a>
          <a href="artemisia.html" data-cursor>Artemisia <span>쑥차</span></a>
          <a href="persimmon.html" data-cursor>Persimmon Leaf <span>감잎차</span></a>
          <a href="hwangto.html" data-cursor>Hwangto <span>황토</span></a>
        </div>
      </div>
    </nav>
    <div class="nav-right">
      <a class="nav-cart mono" href="#" data-cursor data-cart-open data-cart-count>CART — 0</a>
      <button class="nav-burger" id="nav-burger" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span>
      </button>
    </div>
  </header>

  <div class="mobile-menu" id="mobile-menu" aria-hidden="true">
    <nav aria-label="Mobile">
      <a href="../index.html">Home</a>
      <a href="../index.html#specimen">Collection</a>
      <a href="../index.html#ethos">Story</a>
      <a href="../index.html#ritual">Ritual</a>
    </nav>
    <div class="mobile-menu-shop">
      <a class="mono mobile-menu-shop-all" href="../shop.html">SHOP — 상점 →</a>
      <a href="sejak.html">Sejak 세작</a>
      <a href="artemisia.html">Artemisia 쑥차</a>
      <a href="persimmon.html">Persimmon Leaf 감잎차</a>
      <a href="hwangto.html">Hwangto 황토</a>
    </div>
    <div class="mobile-menu-foot mono">
      <a href="https://www.instagram.com/koyo_teas" target="_blank" rel="noopener">IG — @KOYO_TEAS</a>
      <span>EST. 2019 — 고요</span>
    </div>
  </div>

  <main class="tea-main">

    <!-- ═══════════ PRODUCT ═══════════ -->
    <section class="tea-hero">
      <p class="tea-breadcrumb mono" data-reveal>
        <a href="../index.html#specimen" data-cursor>THE COLLECTION</a> &nbsp;/&nbsp; %%NAME_UPPER%%
      </p>
      <div class="tea-grid">

        <div class="tea-gallery" data-reveal>
          <div class="tea-stage">
            <img id="tea-stage-img" src="../assets/img/pilecut-%%ID%%.webp" alt="%%NAME%% loose leaf tea" />
          </div>
          <div class="tea-thumbs">
            <button class="tea-thumb is-active" data-src="../assets/img/pilecut-%%ID%%.webp" data-cursor>
              <img src="../assets/img/pilecut-%%ID%%.webp" alt="" loading="lazy" /><span class="mono">THE LEAVES</span>
            </button>
            <button class="tea-thumb" data-src="../assets/img/leafcut-%%ID%%.webp" data-cursor>
              <img src="../assets/img/leafcut-%%ID%%.webp" alt="" loading="lazy" /><span class="mono">STEEPED</span>
            </button>
            <button class="tea-thumb" data-src="../assets/img/cupcut-%%ID%%.webp" data-cursor>
              <img src="../assets/img/cupcut-%%ID%%.webp" alt="" loading="lazy" /><span class="mono">THE CUP</span>
            </button>
            <button class="tea-thumb" id="pouch-thumb" data-src="../assets/img/packcut-%%ID%%-loose.webp" data-cursor>
              <img src="../assets/img/packcut-%%ID%%-loose.webp" alt="" loading="lazy" /><span class="mono">THE POUCH</span>
            </button>
          </div>
        </div>

        <div class="tea-info">
          <p class="eyebrow mono" data-reveal>N° %%NUMBER%% — %%TYPE_LINE%%</p>
          <h1 class="tea-name" data-reveal>%%NAME%% <span>%%KR%%</span></h1>
          <p class="tea-lede" data-reveal>%%LEDE%%</p>

          <dl class="panel-data mono" data-reveal>
%%DATA_ROWS%%
          </dl>

          <div class="tea-buy" data-reveal>
            <span class="format-label mono">FORMAT — 형태</span>
            <div class="format" role="radiogroup" aria-label="Format">
              <button class="format-opt is-active" data-format="loose" data-cursor>
                Loose Leaf<span class="mono">$%%PRICE_LOOSE%% · TIN-TIE POUCH</span>
              </button>
              <button class="format-opt" data-format="sachet" data-cursor>
                Sachets<span class="mono">$%%PRICE_SACHET%% · PLA, PLANT-BASED</span>
              </button>
            </div>
            <p class="tea-price is-visible" id="tea-price">$%%PRICE_LOOSE%%</p>
            <div class="tea-buy-row">
              <div class="qty" aria-label="Quantity">
                <button id="qty-minus" aria-label="Decrease quantity" data-cursor>−</button>
                <span id="qty-value">1</span>
                <button id="qty-plus" aria-label="Increase quantity" data-cursor>+</button>
              </div>
              <button class="btn btn-solid" id="add-to-cart" data-cursor data-magnetic
                      data-tea-id="%%ID%%" data-tea-name="%%NAME%%" data-tea-kr="%%KR%%"
                      data-price-loose="%%PRICE_LOOSE%%" data-price-sachet="%%PRICE_SACHET%%">
                Add to order
              </button>
            </div>
            <p class="tea-ship mono">SMALL BATCH — HAND-PACKED · SHIPS FROM GRAND RAPIDS, MI</p>
          </div>
        </div>

      </div>
    </section>

    <!-- ═══════════ STORY ═══════════ -->
    <section class="tea-story">
      <p class="eyebrow mono" data-reveal>THE STORY — 이야기</p>
%%STORY%%
    </section>

    <!-- ═══════════ BREW ═══════════ -->
    <section class="tea-brew">
      <p class="eyebrow mono" data-reveal>HOW TO BREW — 손맛</p>
      <h2 class="ritual-title" data-reveal>Brewed by feel.</h2>
      <ol class="ritual-steps">
%%BREW_STEPS%%
      </ol>
      <p class="tea-brew-note" data-reveal>
        These are recommendations, never law. <em>Sohn-mat</em> trusts your hands.
      </p>
    </section>

    <!-- ═══════════ BENEFITS ═══════════ -->
    <section class="tea-benefits">
      <p class="eyebrow mono" data-reveal>WHAT'S INSIDE — 효능</p>
      <ul>
%%BENEFITS%%
      </ul>
    </section>

    <!-- ═══════════ PROVENANCE ═══════════ -->
    <section class="tea-prov">
      <p class="eyebrow mono" data-reveal>PROVENANCE — 산지</p>
      <ul class="prov-grid">
        <li data-reveal><strong>%%REGION%%</strong><span class="mono">%%REGION_NOTE%%</span></li>
        <li data-reveal><strong>Organic</strong><span class="mono">PESTICIDE-FREE, ALWAYS</span></li>
        <li data-reveal><strong>By hand</strong><span class="mono">PICKED &amp; SORTED, LEAF BY LEAF</span></li>
        <li data-reveal><strong>Small batch</strong><span class="mono">QUALITY OVER QUANTITY</span></li>
      </ul>
    </section>

    <!-- ═══════════ KEEPING ═══════════ -->
    <section class="tea-keeping">
      <p class="eyebrow mono" data-reveal>KEEPING — 보관</p>
      <p class="tea-keeping-note" data-reveal>%%KEEPING%%</p>
      <p class="mono" data-reveal>%%KEEPING_TIP%%</p>
    </section>

    <!-- ═══════════ RELATED ═══════════ -->
    <section class="tea-related">
      <p class="eyebrow mono" data-reveal>CONTINUE THE COLLECTION — 차</p>
      <div class="tea-related-grid">
%%RELATED%%
      </div>
    </section>

  </main>

  <!-- ═══════════ FOOTER ═══════════ -->
  <footer class="footer">
    <div class="footer-top">
      <div class="footer-brand">
        <img src="../assets/img/koyo-mark-paper.png" alt="Koyo mark" class="footer-mark" />
        <p class="footer-tag">Stillness guides purpose.</p>
      </div>
      <div class="footer-cols">
        <div class="footer-col">
          <p class="footer-head mono">SHOP</p>
          <a href="../shop.html" data-cursor>The Shelf — all teas</a>
          <a href="sejak.html" data-cursor>Sejak</a>
          <a href="artemisia.html" data-cursor>Artemisia</a>
          <a href="persimmon.html" data-cursor>Persimmon Leaf</a>
          <a href="hwangto.html" data-cursor>Hwangto</a>
        </div>
        <div class="footer-col">
          <p class="footer-head mono">COMPANY</p>
          <a href="../index.html#ethos" data-cursor>Our story</a>
              <a href="#" data-cursor>Journal</a>
          <a href="#" data-cursor>Wholesale</a>
        </div>
        <div class="footer-col">
          <p class="footer-head mono">CONNECT</p>
          <a href="https://www.instagram.com/koyo_teas" target="_blank" rel="noopener" data-cursor>Instagram — @koyo_teas</a>
          <a href="mailto:info@koyoteas.com" data-cursor>info@koyoteas.com</a>
        </div>
      </div>
    </div>
    <p class="footer-kr" aria-hidden="true">고요</p>
    <div class="footer-bottom mono">
      <span>© 2026 KOYO TEAS</span>
      <span>LOS ANGELES · GRAND RAPIDS · HADONG</span>
    </div>
  </footer>

  <!-- Cart -->
  <div class="cart-backdrop" id="cart-backdrop"></div>
  <aside class="cart-drawer" id="cart-drawer" aria-hidden="true" aria-label="Cart">
    <header class="cart-head">
      <p class="mono">YOUR ORDER — 주문</p>
      <button class="cart-close" aria-label="Close cart">×</button>
    </header>
    <div class="cart-lines"></div>
    <footer class="cart-foot">
      <div class="cart-subtotal"><span class="mono">SUBTOTAL</span><span class="cart-subtotal-amount"></span></div>
      <button class="btn btn-solid cart-checkout" data-cursor>Checkout</button>
      <p class="cart-note"></p>
    </footer>
  </aside>

  <script type="module" src="../js/tea.js"></script>
  <noscript><style>[data-reveal]{opacity:1 !important}</style></noscript>
</body>
</html>
"""


def render(tea_id, tea):
    data_rows = "\n".join(
        f'            <div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in tea["data_rows"])
    story = "\n".join(
        f'      <p class="tea-story-text" data-reveal>{p}</p>' for p in tea["story"])
    brew = "\n".join(
        f'''        <li data-reveal>
          <span class="ritual-hanja" aria-hidden="true">{hanja}</span>
          <h3>{title}</h3>
          <p>{body}</p>
        </li>''' for hanja, title, body in tea["brew_steps"])
    benefits = "\n".join(
        f'        <li data-reveal>{b}</li>' for b in tea["benefits"])
    related = "\n".join(
        f'''        <a class="tea-related-card" href="{rid}.html" data-cursor data-reveal>
          <img src="../assets/img/pilecut-{rid}.webp" alt="{TEAS[rid]["name"]} loose leaf" loading="lazy" />
          <h3>{TEAS[rid]["name"]} <span>{TEAS[rid]["kr"]}</span></h3>
          <p class="mono">N° {TEAS[rid]["number"]} — {TEAS[rid]["type_line"]}</p>
        </a>''' for rid in tea["related"])

    html = TEMPLATE
    for key, val in {
        "%%ID%%": tea_id,
        "%%TITLE%%": tea["title"],
        "%%DESCRIPTION%%": tea["description"],
        "%%NAME%%": tea["name"],
        "%%NAME_UPPER%%": tea["name"].upper(),
        "%%KR%%": tea["kr"],
        "%%NUMBER%%": tea["number"],
        "%%TYPE_LINE%%": tea["type_line"],
        "%%LEDE%%": tea["lede"],
        "%%DATA_ROWS%%": data_rows,
        "%%STORY%%": story,
        "%%BREW_STEPS%%": brew,
        "%%BENEFITS%%": benefits,
        "%%PRICE_LOOSE%%": str(tea["price_loose"]),
        "%%PRICE_SACHET%%": str(tea["price_sachet"]),
        "%%REGION%%": tea["region"],
        "%%REGION_NOTE%%": tea["region_note"],
        "%%KEEPING%%": tea["keeping"],
        "%%KEEPING_TIP%%": tea["keeping_tip"],
        "%%RELATED%%": related,
    }.items():
        html = html.replace(key, val)
    return html


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for tea_id, tea in TEAS.items():
        path = os.path.join(OUT_DIR, f"{tea_id}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(render(tea_id, tea))
        print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
