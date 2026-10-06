# Website Todo

## Trust Bar — Employer Logo Permissions

Need to seek authority from each employer before displaying their logos on the site.

### Logos requiring permission
- [ ] Altair
- [ ] FatFace
- [ ] Nottingham Trent University
- [ ] Sopra Steria
- [ ] Target

### Pages affected (commented out until permissions granted)
- [x] Homepage (`themes/bms-theme/layouts/index.html`) — commented out
- [x] Employers page (`themes/bms-theme/layouts/employers/list.html`) — commented out

### Section backgrounds changed to white (restore when trust bars go live)
- [ ] Homepage "Our Services" — restore `section--cream` (currently `section--white`) in `index.html`
- [ ] Individuals "What Are You Looking to Achieve?" — restore `section--off-white` (currently `section--white`) in `individuals/list.html`

### To reactivate
Once permissions are confirmed, uncomment the relevant `<!-- Partner Logos Section -->` or `<!-- Lender Trust Bar -->` block in each affected layout file. Remove any logos where permission was not granted. Also restore the section background classes listed above.

---

## Trust Bar — Lender Logo Permissions

Need to seek authority from each lender before displaying their logos on the site.

### Logos requiring permission
- [ ] Halifax
- [ ] Santander
- [ ] Barclays
- [ ] HSBC
- [ ] Coventry Building Society
- [ ] NatWest
- [ ] Nationwide

### Pages affected (commented out until permissions granted)
- [x] Individuals/Mortgages page (`themes/bms-theme/layouts/individuals/list.html`) — commented out

---

## Mortgage pages redesign — follow-up (raised 6 October 2026)

Feedback on the combined homepage preview at `/home-new/`. Items marked
**placeholder built** are visible in the design now and need real content.

### Infographic videos

Several explanatory sections would work better as short infographic videos
than as text. A placeholder block (title + 16:9 frame + play affordance) is in
place so the layout can be judged before any video exists.

- [x] **What's different about using a mortgage adviser?** — placeholder built.
      Comparison table kept beneath the video for people who prefer to read.
- [x] **What happens after you get in touch** — placeholder built. Five-step
      stepper kept beneath.
- [ ] **Self-employed or complex income** — add a video placeholder to match.
- [ ] **Complex credit** — new section, doesn't exist yet. Adverse credit,
      defaults, CCJs, missed payments. Needs copy writing from scratch as well
      as a video.
- [ ] Decide production route, aspect ratio and whether videos are hosted
      (YouTube/Vimeo embed) or self-hosted. Embeds will need a cookie-consent
      path, since the current banner gates third-party scripts.
- [ ] Replace `.video-block__frame` placeholder styling with a real poster
      image per video, and add captions/transcripts for accessibility.

### Pages to split out of the homepage

`/mortgages/first-time-buyers/` and `/mortgages/remortgage/` already exist and
are the pattern to follow — hero, what we help with, process, FAQs, CTA.

- [ ] **Moving home** → `/mortgages/moving-home/`. Currently the
      `#moving-home` section on the homepage. The brief has this as Phase 2.2.
- [ ] **Buy-to-let** → `/mortgages/buy-to-let/`. Currently the `#buy-to-let`
      section. Must carry the "most buy-to-let mortgages are not regulated by
      the Financial Conduct Authority" note, and the £295 fee (see Fees).
- [ ] When each page is created: add it to the Mortgages dropdown in
      `hugo.toml`, remove the homepage section, and update the journey card
      link that currently points at the anchor.

### Sections needing design work

- [ ] **Protection teaser** — the three scenario cards are plain. Needs a
      stronger visual treatment. The brief's Phase 2.3 rebuilds the protection
      page around these same scenarios, so design them together.
- [ ] **For employers** — currently a plain text block. Wants a more
      interesting banner. Note the employer logo trust bar above is still
      blocked on permissions, so the banner can't rely on logos yet.

### Content

- [x] **Fees section** — built on the homepage. No fee for residential
      mortgage advice; £295 for buy-to-let.
- [ ] Confirm **when the £295 buy-to-let fee is payable** (on application, on
      offer, or on completion) and whether it is refundable. The section says
      only what was confirmed; the timing line is marked INPUT NEEDED.
- [ ] Check the fee statement against **Openwork's required wording** before
      go-live. This supersedes open question Q4 in the redesign brief, and the
      old "we may charge a fee, agreed upfront" FAQ answer has been replaced.
- [ ] **FAQs moved off the homepage.** Each sub-page now owns its own
      questions. Review them for relevance and add page-specific ones —
      moving-home and buy-to-let will need their own once those pages exist.

### Reviews

- [x] **Jotform Google reviews widget restored** on the homepage.
- [ ] Confirm the widget actually renders reviews. It was removed during the
      redesign because it was leaving an empty "What Our Clients Say" heading
      next to a "5-star rated on Google" claim, which is the one thing to
      avoid. If it renders empty again, either populate it or switch back to
      the `reviews.html` partial, which renders nothing at all when it has no
      data.
- [ ] Decide long-term: live widget, or the static `data/reviews.json`
      component with real reviews supplied once (brief question Q6).

---
