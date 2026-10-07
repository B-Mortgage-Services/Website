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

Built as a responsive carousel ("The short version"), four cards with a brief
description under each. Shows 4 / 3 / 2 / 1-plus-peek as the viewport narrows;
arrows appear only when the track actually scrolls.

- [x] **Bank or broker? What actually changes.**
- [x] **From first call to front door.**
- [x] **Self-employed? What lenders actually look at.**
- [x] **Credit history isn't simply pass or fail.** — new topic, placeholder
      only. Adverse credit, defaults, CCJs, missed payments. Needs copy as well
      as a video.

**Content removed from the homepage to make room.** The broker-vs-bank
comparison table is gone — its content is meant to live in the first video,
so until that video exists the homepage does not explain the difference in
text. The table is in git history if it needs to come back or move to a
sub-page.

The five-step process was briefly removed too, then **reinstated** — a
placeholder conveys nothing and the page was visibly missing that
reassurance. It keeps Bev's quote, which belongs with it. The matching video
was dropped from the carousel so the two don't duplicate.

The self-employed / complex income section was **removed entirely**,
including its dropdown menu item: it did not earn the space it took given the
carousel video covers the same ground. The `?topic=complex-income` mapping on
the contact page is left in place and still works if a link ever uses it.
- [ ] Decide production route, aspect ratio and whether videos are hosted
      (YouTube/Vimeo embed) or self-hosted. Embeds will need a cookie-consent
      path, since the current banner gates third-party scripts.
- [ ] Replace `.video-block__frame` placeholder styling with a real poster
      image per video, and add captions/transcripts for accessibility.

### Pages to split out of the homepage

`/mortgages/first-time-buyers/` and `/mortgages/remortgage/` already exist and
are the pattern to follow — hero, what we help with, process, FAQs, CTA.

- [x] **Moving home** → `/mortgages/moving-home/`. Built. Porting vs a new
      mortgage, five-step process, six FAQs. Removed from the homepage and
      added to the Mortgages dropdown.
- [x] **Buy-to-let** → `/mortgages/buy-to-let/`. Built. How BTL lending
      differs, who we help, the £295 fee, a tax note pointing at an
      accountant, six FAQs. Carries the unregulated note in the hero and
      again in the FAQs. Removed from the homepage.
- [ ] **Self-employed & complex income** → `/mortgages/self-employed/` is the
      last one still living as a `#complex-income` section on the homepage.
- [ ] Both new pages claim things that should be checked before go-live:
      that porting is never guaranteed, and the general shape of BTL criteria
      (larger deposits, rent-based stress testing, interest-only being common).
      All are hedged with "usually" or "typically" and none names a figure,
      but they are still statements about lending and need Openwork sign-off.

### Sections needing design work

- [x] **Protection teaser** — rebuilt as proper cards: accent bar, icon in a
      tinted circle, the scenario as a label, the question as the main text,
      and the product name below a hairline rule. Built as the
      `protection-scenarios.html` partial, because the brief's Phase 2.3
      rebuilds the protection page around these same three scenarios — reuse
      it there rather than rewriting the markup.
- [ ] When the protection page is rebuilt (Phase 2.3), consider linking each
      scenario card to the matching section on that page. They are static at
      the moment because there is nothing specific to link to yet.
- [x] **For employers** — resolved differently. A banner was built, then the
      whole bottom-of-page section was removed because it didn't sit well with
      the rest of the homepage. Employers are now the fourth journey card
      ("Solutions in the workplace"), which surfaces them higher up and treats
      them as an audience rather than an afterthought. The `.employer-banner`
      CSS is still in main.css if a banner is wanted on /employers/ itself.
- [ ] Decide whether "Solutions in the workplace" is the right card title. The
      other three cards are first-person visitor intents ("Buy my first home",
      "Move home"), so this one breaks the pattern. A first-person
      alternative would read "Support my team".

### Performance and markup — resolved

- [x] **The wellness questionnaire no longer sits in every page's DOM.** It
      was ~23KB of markup after the footer on all 18 pages, including 18
      inputs, 12 selects and 10 headings, on pages that could never open it.
      It now lives in a `<template>` and is cloned into the page by
      `ensureWellnessModal()` on first open, and the template itself only
      ships on pages with `wellnessModal: true` in their front matter —
      currently /wellness/, /affordability-calculator/ and
      /overpayment-calculator/.
- Worth knowing for the record: the old `visibility: hidden` did already keep
  it out of the accessibility tree and the tab order, so screen readers were
  not reading it out, and there was no `<form>` element so nothing could be
  submitted. The real costs were page weight, document structure, and
  crawlable content on pages it had no business being on. Those are fixed.
- [ ] **If you add a wellness trigger to a new page, set `wellnessModal: true`
      in its front matter.** Forgetting now degrades to a redirect to
      /wellness/ rather than a dead button, but it is still worth getting
      right.

### Compliance

- [x] **Openwork approval line is always shown in the footer**, on all 18
      pages, falling back to "xx/xx/xxxx" until a real date exists. This
      deliberately reverses the redesign brief, which said to hide the
      sentence rather than publish a placeholder (its §2.2), and means the
      brief's acceptance check "no xx/xx/xxxx anywhere in the built site" will
      now fail by design. Noted so nobody 'fixes' it back.
- [ ] **Set `financialPromotionApprovalDate` in `hugo.toml`** the moment the
      pages are approved, e.g. "6 October 2026". It fills in site-wide from
      that one value. Verified both states render correctly.
- [ ] Until then, be aware the live site carries a visible placeholder date.
      Worth a decision before go-live about whether that is acceptable to show
      the public, or whether the pages should simply not be published until
      approved.

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

### Reviews — resolved

- [x] **Jotform Google reviews widget restored** on the homepage. Confirmed it
      is populated live from Google in the real build, so the empty-section
      problem the redesign brief raised does not apply. No further action.
- The `reviews.html` partial and empty `data/reviews.json` remain in the repo
  as the fallback if the widget is ever dropped. Brief question Q6 (supplying
  static reviews) is therefore moot unless that happens.

---
