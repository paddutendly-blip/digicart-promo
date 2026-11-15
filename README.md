# DigiCart Promotion

A small web app, separate from the DigiCart app, for promoting DigiCart to shop owners.

| Page | Who opens it | What it does |
|---|---|---|
| `grocery.html`, `fashion.html`, … (one per category) | Shop owners, from the WhatsApp link | Shows that category's preview picture in WhatsApp, then opens the demo straight away |
| `index.html` (the demo) | Shop owners | Language → category → 8-step animated demo of *their own* shop with real product photos → plans, offer, free setup, Call / WhatsApp / **Download DigiCart**, the category's 1-minute video |
| `hub.html` (Promotion Hub) | You (passcode) | Shops list, one-by-one WhatsApp sending, live activity with sound alerts, hot leads, follow-ups, links with QR, printable posters, all 9 videos, ready captions, your own photos and videos, offer & price settings, CSV export |

**Categories (all with demo, video, preview picture and posters):** Fashion, Grocery, Fruits & vegetables, Super mart, Electronics & home
appliances, Gifts & fancy, Kirana, Footwear, Laundry (pickup bookings), Electrical & hardware.

Data lives in **your own Google Sheet** (tabs *Shops*, *Events*, *Settings*, *Media*). Photos and videos you add
from the hub are saved in your Google Drive, in a folder called **DigiCart Promotion Media**.

```
.github/workflows/pages.yml   publishes the site and fills in the preview-picture addresses
apps-script/Code.gs           the Google Sheet backend (paste into Apps Script)
site/                         the website
  catalog.js                  every category's products, sections and texts
  products/<category>/        product photos (from your catalogue and collages)
  videos/<category>.mp4       the 1-minute ads (+ .jpg cover)
  og/<category>.jpg           WhatsApp preview pictures
tools/                        test copy with a pretend sheet: node tools/local_server.js
```

## Setup (about 20 minutes, one time)

### 1. Google Sheet backend
1. Open **sheets.new** and name the sheet **DigiCart Promotion**.
2. **Extensions → Apps Script**. Delete what's there, paste all of `apps-script/Code.gs`, press **Save**.
3. Choose **setup** in the function list at the top and press **Run**. Allow access when Google asks
   (Advanced → Go to project → Allow). It creates the tabs and the Drive folder.
4. **Deploy → New deployment →** ⚙️ **Web app**. *Execute as:* **Me**. *Who has access:* **Anyone**. **Deploy**.
5. Copy the **Web app URL** (ends with `/exec`).
6. Open `site/config.js` on your computer and paste that URL between the quotes of `API_URL`. Save.
7. Optional: choose **installDailySummary** and press **Run** to get an evening summary email every day.

### 2. Website on GitHub Pages (free)
1. On github.com: **New repository** → name **digicart-promo** → **Public** → Create.
2. Upload everything in this folder (`.github`, `apps-script`, `site`, `tools`, `README.md`):
   - **Easiest: GitHub Desktop** → File → Add local repository (or clone the new repo), copy the folder contents in,
     **Commit to main** → **Push**. One go, any number of files.
   - **Or the website:** **Add file → Upload files**. GitHub takes up to 100 files at a time, so upload in batches:
     (a) `.github`, `apps-script`, `tools`, `README.md` and the files directly inside `site` (not its folders);
     (b) `site/og` and `site/videos`; (c) `site/products/fashion`, `electronics`, `footwear`, `gifts`;
     (d) `site/products/grocery`, `hardware`, `kirana`, `laundry`, `supermart`. Keep the folder names as they are.
     If the hidden `.github` folder won't upload: **Add file → Create new file**, name it
     `.github/workflows/pages.yml` and paste the contents of that file.
3. **Settings → Pages → Source: GitHub Actions**.
4. **Actions** tab → **Publish website** → wait for the green tick (about a minute; it re-runs on every upload).
   Your site: `https://YOUR-GITHUB-NAME.github.io/digicart-promo/`.

### 3. Start
1. Open `https://YOUR-GITHUB-NAME.github.io/digicart-promo/hub.html` on your phone.
2. Type a passcode (6+ characters). The first one you type becomes your passcode.
3. Chrome menu → **Add to Home screen**, so the hub opens like an app. Settings tab → **Setup check** should be all green.
4. Home tab → **Turn on alerts**. Shops tab → **Add shops**, pick the category, paste `Name, phone, area` lines.
5. Grow tab → download that category's video and forward it to the shop on WhatsApp.
6. Send tab → **Open WhatsApp** → send → **Next**, shop after shop.

## Day to day
- **Add your own photos or videos:** hub → Grow → pick the category and section → **➕ Add photos / videos** → choose from
  the gallery or camera. They upload by themselves and appear first in that category's demo within a minute. Type a name and
  price under each photo if you like. Untick **Show in demo** to keep one out. Videos up to 35 MB; for longer ones put them
  on YouTube and paste the link.
- **Offer ends / prices change:** hub → Settings. Shops see it the next time they open the link (no upload needed).
  The videos say "Diwali offer" out loud, so after 20 November ask for new videos.
- **Forgot passcode:** Apps Script editor → run **resetPasscode** → type a new one in the hub.
- **Changed Code.gs later:** Deploy → Manage deployments → ✏️ → Version: **New version** → Deploy (the URL stays the same).

## What a shop owner sees is tracked
Opened (and how many times), language, category tapped, each demo step, the plans page, taps on Call /
WhatsApp / free setup / Download, video play, time on the page and phone model. The demo page says so
at the bottom ("We see when this page is opened, so we can help you set up").
