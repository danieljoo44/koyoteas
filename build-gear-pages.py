#!/usr/bin/env python3
"""Generate teaware product pages (gear/*.html) from the tea-page chrome.

Edit GEAR below, run `python3 build-gear-pages.py`. Reuses the current
tea/sejak.html for head/nav/footer/cart so gear pages always match the
site chrome — run build-tea-pages.py first if the chrome changed.
Prices are the makers' MSRPs (Daniel: keep same as their sites).
"""
import re, os

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "koyo-site")

GEAR = {
    "simple-steeper": {
        "name": "The Simple Steeper",
        "brand": "KOYO",
        "eyebrow": "DESIGNED BY KOYO — 고요의 도구",
        "lede": "One piece of glass, start to finish. Leaves go in the body, "
                "water follows, and the built-in filter holds every leaf back "
                "as you pour. Nothing to assemble, nothing to lose. A rinse "
                "and it is clean.",
        "specs": [
            ("BODY", "Unibody borosilicate 3.3 glass"),
            ("CAPACITY", "500 ml"),
            ("FILTER", "Built in, nothing removable"),
            ("HEAT", "Boiling water safe, lead-free"),
            ("CLEAN", "Dishwasher safe"),
        ],
        "variant_label": None,
        "variants": [
            ("glass", "Clear Glass · 500 ml", 19.00, "steeper-liquor.webp"),
        ],
        "gallery": [
            ("steeper-liquor.webp", "THE STEEPER"),
            ("steeper-filter.webp", "THE FILTER"),
            ("steeper-pour.webp", "THE POUR"),
        ],
    },
    "atmos": {
        "name": "Atmos Vacuum Canister",
        "brand": "FELLOW",
        "eyebrow": "TEAWARE — 다구 · FELLOW",
        "lede": "A twist of the lid pulls the air out. Vacuum-sealed, "
                "light-tight keeping for loose leaf, so the harvest tastes "
                "like the week it was picked.",
        "specs": [
            ("CAPACITY", "0.7 L"),
            ("MATERIAL", "Borosilicate glass"),
            ("SEAL", "Integrated vacuum lid"),
            ("CARE", "Lid hand-wash only"),
        ],
        "variant_label": "MODEL — 형태",
        "variants": [
            ("electric", "Electric · Clear · 0.7 L", 69.95, "atmos-electric.webp"),
            ("manual", "Manual · Clear · 0.7 L", 34.95, "atmos-manual.webp"),
        ],
    },
    "stagg-ekg": {
        "name": "Stagg EKG Pro Electric Kettle",
        "brand": "FELLOW",
        "eyebrow": "TEAWARE — 다구 · FELLOW",
        "lede": "To-the-degree control for every leaf on our shelf, from "
                "74°C sejak water to a full boil for hwangto. The gooseneck "
                "pours exactly where you ask it to.",
        "specs": [
            ("CAPACITY", "0.9 L"),
            ("CONTROL", "±1°, 57–100°C"),
            ("HOLD", "60-minute temperature hold"),
            ("POUR", "Precision gooseneck"),
        ],
        "variant_label": "FINISH — 마감",
        "variants": [
            ("matteblack", "Matte Black", 179.95, "ekg-matteblack.webp"),
            ("blackwalnut", "Matte Black + Walnut", 199.95, "ekg-blackwalnut.webp"),
        ],
    },
    "monty": {
        "name": "Monty Milk Art Cup",
        "brand": "FELLOW",
        "eyebrow": "TEAWARE — 다구 · FELLOW",
        "lede": "A low, wide ceramic cup we reach for at the tea table. The "
                "matte black exterior sets off the color of the liquor; the "
                "weighted base sits calm in the hand.",
        "specs": [
            ("SIZE", "Cappuccino, 6.5 oz"),
            ("FINISH", "Matte black, glazed interior"),
            ("FORM", "Wide mouth, low profile"),
            ("CARE", "Dishwasher safe"),
        ],
        "variant_label": None,
        "variants": [
            ("black-cappuccino", "Matte Black · Cappuccino 6.5 oz", 24.95, "monty-black-cappuccino.webp"),
        ],
    },
    "lunar": {
        "name": "Acaia Lunar",
        "brand": "ACAIA",
        "eyebrow": "TEAWARE — 다구 · ACAIA",
        "lede": "The scale we weigh every gram of leaf on. Hundredth-of-a-gram "
                "resolution, instant response, small enough to live beside "
                "the kettle.",
        "specs": [
            ("RESOLUTION", "0.01 g"),
            ("CAPACITY", "2,000 g"),
            ("RESPONSE", "20 ms"),
            ("CHARGE", "USB-C"),
        ],
        "variant_label": "COLOR — 색",
        "variants": [
            ("black", "Black", 250.00, "lunar-black.webp"),
            ("spacegray", "Space Gray", 250.00, "lunar-spacegray.webp"),
            ("silver", "Silver", 250.00, "lunar-silver.webp"),
            ("coolwhite", "Cool White", 250.00, "lunar-coolwhite.webp"),
            ("beigewhite", "Beige White", 250.00, "lunar-beigewhite.webp"),
        ],
    },
    "pearl": {
        "name": "Acaia Pearl",
        "brand": "ACAIA",
        "eyebrow": "TEAWARE — 다구 · ACAIA",
        "lede": "The classic brewing scale: weight and time on one quiet "
                "display, precise enough for leaf, wide enough for the pot.",
        "specs": [
            ("RESOLUTION", "0.1 g"),
            ("CAPACITY", "3,000 g"),
            ("DISPLAY", "Weight + brew timer"),
            ("CHARGE", "USB-C"),
        ],
        "variant_label": "COLOR — 색",
        "variants": [
            ("pitchblack", "Pitch Black", 150.00, "pearl-pitchblack.webp"),
            ("classicblack", "Classic Black", 150.00, "pearl-classicblack.webp"),
            ("classicwhite", "Classic White", 150.00, "pearl-classicwhite.webp"),
        ],
    },
    "tea-scoop": {
        "name": "Acaia Tea Scoops",
        "brand": "ACAIA",
        "eyebrow": "TEAWARE — 다구 · ACAIA",
        "lede": "An anodized aluminum scoop set for dosing delicate leaves. "
                "Rests flat on the scale, pours without a spill, and makes "
                "the one-gram habit effortless.",
        "specs": [
            ("MATERIAL", "Anodized aluminum"),
            ("SET", "Two scoops"),
            ("USE", "Dose · weigh · transfer"),
            ("CARE", "Hand wash"),
        ],
        "variant_label": None,
        "variants": [
            ("set", "Set of Two", 40.00, "teascoop.webp"),
        ],
    },
}


def money(p):
    return f"${p:,.2f}".replace(".00", "")


def build():
    base = open(os.path.join(SITE, "tea", "sejak.html")).read()
    head_end = base.index('<main class="tea-main">')
    prefix = base[:head_end] + '<main class="tea-main">\n'
    suffix = base[base.index("  </main>"):]
    suffix = suffix.replace("../js/tea.js", "../js/gear.js")

    os.makedirs(os.path.join(SITE, "gear"), exist_ok=True)
    for gid, g in GEAR.items():
        head = prefix
        head = re.sub(r"<title>.*?</title>",
                      f"<title>{g['name']} — Koyo Teaware</title>", head, count=1)
        head = re.sub(r'(<meta name="description" content=")[^"]*',
                      r"\g<1>" + f"{g['name']} at Koyo — {g['lede'][:110]}", head, count=1)
        head = re.sub(r'(<meta property="og:image" content=")[^"]*',
                      r"\g<1>" + f"../assets/img/gear/{g['variants'][0][3]}", head, count=1)

        first = g["variants"][0]
        specs = "\n".join(
            f"            <div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in g["specs"])

        thumbs = ""
        if g.get("gallery"):
            btns = "\n".join(
                f"""            <button class="tea-thumb{' is-active' if i == 0 else ''}" data-src="../assets/img/gear/{img}">
              <img src="../assets/img/gear/{img}" alt="" loading="lazy" /><span class="mono">{label}</span>
            </button>""" for i, (img, label) in enumerate(g["gallery"]))
            thumbs = f'          <div class="tea-thumbs">\n{btns}\n          </div>'

        if g["variant_label"] and len(g["variants"]) > 1:
            opts = "\n".join(
                f'''              <button class="format-opt{' is-active' if i == 0 else ''}"
                      data-variant="{vid}" data-price="{price}"
                      data-label="{label}" data-img="../assets/img/gear/{img}">
                {label}<span class="mono">{money(price)}</span>
              </button>''' for i, (vid, label, price, img) in enumerate(g["variants"]))
            picker = f'''            <span class="format-label mono">{g["variant_label"]}</span>
            <div class="format" role="radiogroup" aria-label="Options">
{opts}
            </div>'''
        else:
            picker = ""

        ship = ("DESIGNED IN-HOUSE BY KOYO · SHIPS FROM GRAND RAPIDS, MI"
                if g["brand"] == "KOYO"
                else "AUTHORIZED " + g["brand"] + " RETAILER · SHIPS FROM GRAND RAPIDS, MI")
        if g.get("launch"):
            buy = f'''            <p class="tea-price is-visible">First firing, arriving soon</p>
            <div class="tea-buy-row">
              <a class="btn btn-ghost" href="../index.html#letter">Be first to know</a>
            </div>
            <p class="tea-ship mono">DESIGNED IN-HOUSE BY KOYO · SHIPS FROM GRAND RAPIDS, MI</p>'''
        else:
            buy = f'''{picker}
            <p class="tea-price is-visible" id="gear-price">{money(first[2])}</p>
            <div class="tea-buy-row">
              <div class="qty" aria-label="Quantity">
                <button id="qty-minus" aria-label="Decrease quantity">−</button>
                <span id="qty-value">1</span>
                <button id="qty-plus" aria-label="Increase quantity">+</button>
              </div>
              <button class="btn btn-solid" id="add-to-cart"
                      data-gear-id="{gid}" data-gear-name="{g['name']}"
                      data-variant="{first[0]}" data-variant-label="{first[1]}"
                      data-price="{first[2]}">
                Add to order
              </button>
            </div>
            <p class="tea-ship mono">{ship}</p>'''

        band = ""
        if g.get("band"):
            bimg, bl, br = g["band"]
            band = f"""
    <!-- ═══════════ IN USE ═══════════ -->
    <section class="tea-prov" style="padding-top: 0;">
      <figure class="story-film" data-reveal>
        <span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span>
        <div class="story-film-frame">
          <img src="../assets/img/gear/{bimg}" alt="The Simple Steeper in use" loading="lazy" />
        </div>
        <figcaption>
          <span class="mono">{bl}</span>
          <span class="mono">{br}</span>
        </figcaption>
      </figure>
    </section>
"""
        content = f'''
    <!-- ═══════════ PRODUCT ═══════════ -->
    <section class="tea-hero">
      <p class="tea-breadcrumb mono" data-reveal>
        <a href="../shop.html#teaware">TEAWARE</a> &nbsp;/&nbsp; {g["name"].upper()}
      </p>
      <div class="tea-grid">

        <div class="tea-gallery" data-reveal>
          <div class="tea-stage">
            <img id="tea-stage-img" src="../assets/img/gear/{first[3]}" alt="{g['name']}" />
          </div>
{thumbs}
        </div>

        <div class="tea-info">
          <p class="eyebrow mono" data-reveal>{g["eyebrow"]}</p>
          <h1 class="tea-name" data-reveal>{g["name"]}</h1>
          <p class="tea-lede" data-reveal>{g["lede"]}</p>

          <dl class="panel-data mono" data-reveal>
{specs}
          </dl>

          <div class="tea-buy" data-reveal>
{buy}
          </div>
        </div>
      </div>
    </section>

{band}
'''
        out = head + content + suffix
        path = os.path.join(SITE, "gear", f"{gid}.html")
        open(path, "w").write(out)
        print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    build()
