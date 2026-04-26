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

## Coming Soon Homepage (Temporary)

The homepage has been temporarily replaced with a "Coming Soon" landing page while the rest of the site is being finalised.

### What was done
- Original full homepage saved as backup at: `themes/bms-theme/layouts/_full-site-index.html.bak`
- Replaced `themes/bms-theme/layouts/index.html` with a standalone Coming Soon layout
  - Logo, "Coming Soon" eyebrow, headline, subtitle
  - Phone (01452 925209) and email (info@bmortgageservices.co.uk) contact links
  - "Book a Free Consultation" Calendly CTA
  - Inline CSS hides site header navigation and footer (only on the home page) via `.page-home` body class
- All other pages (Mortgages, Insurance, Employers, Tools, Contact) remain fully accessible via direct URLs (e.g. `/individuals/`, `/employers/`, `/contact/`)

### To reverse (restore the full homepage)
1. Delete the current `themes/bms-theme/layouts/index.html` (the coming soon version)
2. Rename `themes/bms-theme/layouts/_full-site-index.html.bak` back to `themes/bms-theme/layouts/index.html`
3. Commit and push — `hugo` will rebuild the full home page

That's it — no other files were changed for the coming soon swap.

---
