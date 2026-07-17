# Origin Post — Talking Points & Research

**Purpose:** Notes to keep open while recording. Not a script. You flow naturally; these are the anchors to hit and the numbers to drop. Stay personal, stay specific, stay non-technical.

**Format:** Long-form video (12–18 min) + cut into 4–6 shorts + blog post + X thread.

**Audience:** Curious operators, not engineers. People who buy tickets, run events, follow music. Anyone who has ever stared at a checkout screen wondering where the extra $56 came from.

---

## The story arc (this is the spine — hit these beats in order)

1. **Hook** — three years ago, I tried to take down Ticketmaster
2. **What happened** — built Mix Tickets with a Netherlands company called GET Protocol
3. **The lesson** — got crushed by my own vendor, not by Ticketmaster
4. **Life happened** — shelved it, kept the docs, moved on
5. **What changed** — AI tools that didn't exist in 2022, and the monopoly is officially cracking
6. **What I'm doing now** — rebuilding it solo, open source, costs me ~$25/month to run
7. **Why it matters** — not chasing a unicorn, building infrastructure that anyone can use
8. **The invitation** — follow along, fork the repo, run your own shows on it

---

## Hook options (pick one, save the others for shorts)

- "Three years ago I tried to take down Ticketmaster. I never got close to Ticketmaster — my own vendor crushed me first."
- "Last month a federal jury called Ticketmaster a monopoly on every single count. The remedy is still being decided. I'm rebuilding what I shelved in 2022 — and this time I'm shipping it as open source."
- "You buy two $100 tickets. You pay $256 at checkout. That extra $56 is not going to the artist."
- "What used to take a venture-backed team and a Series A to build, one person with AI tools can ship in a few weekends. Here's the proof."

---

## The Ticketmaster numbers (drop these throughout, don't bunch them)

### The fees
- **Average fees = 28% of ticket face value** (analyzed across 40 recent concerts including Eras Tour)
- **$100 ticket → $128 at checkout** on average; two $100 tickets → **$256 total**
- Resale fees: Q3 2024 was up **132%** vs 2019 — they take a cut going *and* coming back
- **99.2% of surveyed buyers** said the fees are too high — basically everyone

### The monopoly
- **April 15, 2026**: federal jury found Live Nation/Ticketmaster liable on **every antitrust count submitted**
- DOJ caved and settled early in the trial — **33 state attorneys general pursued anyway and won**
- DOJ settlement caps fees at 15%, requires divesting **13 amphitheater exclusives**, lets SeatGeek/StubHub compete
- Court-ordered remedy phase still pending — could force a **full structural breakup**
- This will run for years through appeals — but the *vibe shift is now*
- **70–80% of major US venues** still have exclusive contracts with Ticketmaster — this is the lock-in
- Live Nation's own EVP just called breakup "terrible" and "impossible legally" (May 2026) — they're scared

### The counter-narrative they push (be ready to address)
- Ticketmaster's defense: "venues get most of the fee, our profit is only ~2% per ticket"
- The truth-shaped part: yes, fees are split with venues and promoters
- The real point: the *system* extracts 28% no matter who gets what slice. It's a coordinated rent on every ticket sold. Whether TM keeps 7% or 28%, the buyer is out 28% and the artist isn't seeing it
- The other point: 80% of venues have *no choice* because of exclusive contracts — that's not a market, that's a tax

---

## The 2022 Mix Tickets story (be personal, be honest)

### What I tried to build
- NFT tickets — rotating QR codes, can't fake them, can't scalp them outside the platform
- Partnered with GET Protocol — Netherlands-based, blockchain ticketing protocol since 2016
- Real partnership, real engineering, real product
- Used Bubble for the front end + Airtable for sensitive data + OpenAI for marketing automation
- Got it working

### What broke it
- The vendor relationship was the bottleneck
- GET forced every prospective venue into a sales call **before** they could see the UI
- Small venues just clicked away — they wanted to play with the product, not book a meeting
- I had no control over the core protocol, no way to iterate the onboarding flow
- Their roadmap wasn't my roadmap
- I worked for free for a long time. Got close. Couldn't get past the vendor friction.

### The honest lesson
- Wasn't Ticketmaster that beat me. Was my own infrastructure dependency
- The mistake wasn't the idea — the idea was right
- The mistake was being locked into someone else's system before I owned my own
- Three years ago, building a full ticketing platform yourself was insane — that's why I partnered
- Now it's not insane. AI changed the cost of building. That's the unlock.

### The shelving
- Life happened, moved on, got into other things
- Kept all the docs, kept the mental model, kept the pain
- This isn't starting over. This is finishing what I started with tools that didn't exist before.

---

## What it actually costs to run it yourself (the leverage moment)

This is the segment that goes viral. Lean into the numbers.

### My stack monthly cost
- **Supabase free tier: $0** (500MB DB, 50,000 monthly users, unlimited API requests, RLS built in)
- **Vercel:** free for personal development; commercial Mixt Hosted usage requires an appropriate paid plan (verify current pricing before publishing)
- **Domain: ~$1/month** ($12/year)
- **Stripe: 2.9% + $0.30 per transaction** (only pay when I sell)
- **Auth:** open Postgres-backed provider for the default deployment; Privy is optional when embedded wallets are needed
- **Total fixed cost:** development can be near zero; commercial hosting varies by provider and must be verified before publishing

### What that means for a real show
- 500-person show, $40 ticket = $20,000 in tickets sold
- On Ticketmaster: ~$5,600 in fees extracted from buyers (28% on $20k)
- Self-hosted Ship Tickets: about $730 in Stripe fees and $0 in Ship Tickets platform fees if every ticket is a separate transaction at the stated 2.9% + 30¢ rate; multi-ticket orders reduce the fixed-fee portion
- Mixt Hosted: the same payment-processing cost plus $2.22 per paid ticket for hosting, upgrades, backups, and support
- **Difference: thousands of dollars stay with the show; calculate the exact comparison from the real order mix before publishing**
- That's the artist's fee. Or the sound engineer. Or the second show that becomes possible because the first one paid for itself.

### The big leverage line
- "In 2022, what I'm building today would have required a Series A, a team of four, and probably 12 months. In 2026, it's me, AI tools, a modest infrastructure budget, and a series of weekends."
- "I'm not building a startup. I'm building a tool I'm giving away."
- "This isn't about replacing Ticketmaster. It's about showing that the only reason they exist is because no one bothered to build the alternative — and now anyone can."

---

## The Big Idea Moment (the segment that gets cut into the viral short)

**The setup:** ticket fees are 28%. The monopoly just lost in court. The tools to replace it are free.

**The punch:** "The thing keeping Ticketmaster alive isn't technology. It's that nobody else has bothered. So I'm bothering."

**The expansion:** This is the actual story of AI in 2026. Not that AI replaces humans. That AI removes the *budget barrier* between an idea and a working product. The reason Ticketmaster has held the market this long isn't that they're irreplaceable. It's that the cost to replace them used to be millions of dollars. Now it isn't. AI didn't kill the middleman by being smart — it killed the middleman by making the alternative cheap enough that anyone can build one.

**Land the plane:** "The 28% you pay at checkout isn't paying for technology. It's paying for the absence of competition. That ends when the alternative is free."

---

## What I'm NOT doing (call these out so the framing is clean)

- Not raising money. Not pitching investors. Not building a unicorn.
- Not charging venues. Tier 0 is free forever, open source, self-hostable.
- Not anti-Ticketmaster the company. Anti-the-system that made them inevitable.
- Not pretending this is the only solution. It's *a* solution. Anyone can fork it and make a better one.

---

## What I AM doing

- Building it publicly. Repo public from day one. Mistakes included.
- Documenting it for non-engineers. The audience for this isn't dev Twitter. It's anyone who's ever wondered why their show ticket has a $28 surcharge.
- Building it modular. Three deployment tiers: free open-source self-host, hosted Stripe version with small fee, hosted Solana version with automatic payout splits.
- Building it with AI as a co-pilot, not a replacement. The architecture decisions, the venue relationships, the content — those are human. The boilerplate, the deploy pipeline, the test scaffolding — that's AI.

---

## Personal beats to weave in (don't force them — let them land naturally)

- The Bradenton/Tampa/St. Pete music scene angle — first venue will be local
- "I'm doing this for fun, which is the only honest reason to do anything right now"
- The DIY ethos — Mixt was originally a collective for artists, gamers, creators. That spirit returns once the rails work.
- The eventual dream: throw my own shows, on my own platform, with my own community
- "Not all AI is bad for the creative game. If you use it to do the boring stuff so humans can do more creative stuff, that's the whole point."

---

## Distribution plan for this piece

### Long-form (15–18 min YouTube)
- Cold open with the strongest hook
- Cut to the 2026 antitrust news clip (find a 10-second news clip)
- Then the personal story (2 min)
- The numbers segment (2 min) — drop the fee data
- The original Mix Tickets story (3 min)
- The shelving and the lesson (1 min)
- What changed / the AI angle (2 min)
- The cost comparison (2 min) — Big Idea Moment lives here
- The invitation / what's next (1 min)

### Shorts (5–6 cuts)
- Hook + "$256 for two tickets" reveal (30 sec)
- "Federal jury ruled them a monopoly last month" + what that means (45 sec)
- "I tried this in 2022 and got crushed by my own vendor" (60 sec)
- The cost comparison: "$5,000 stays with the show" (45 sec)
- The Big Idea Moment: "The 28% isn't paying for technology" (60 sec)
- The leverage line: "Series A in 2022, weekends in 2026" (30 sec)

### Blog post / Substack
- Same arc as long-form, ~900 words
- Embed the YouTube video at top
- Link to repo (when it goes live in Slice 1)
- CTA: subscribe + follow on X

### X thread (8–10 tweets)
- Tweet 1: hook + key stat ($256 for $200 face value)
- Tweet 2: the verdict (April 15, 2026)
- Tweet 3: the personal story setup
- Tweet 4: what I built and how it broke
- Tweet 5: what changed (AI tools, monopoly cracking)
- Tweet 6: the cost numbers ($25/month vs 28% extraction)
- Tweet 7: the leverage line (Series A then, weekends now)
- Tweet 8: what's coming next (open source, build series)
- Tweet 9: invitation to follow
- Tweet 10: link to the long-form video

### LinkedIn (slightly more buttoned-up version)
- Same arc, less slang, emphasize the operator/builder angle
- Title: "I tried to build a Ticketmaster alternative in 2022. The lesson wasn't what I expected."

---

## Sources to cite (drop links in the blog post / show notes)

- April 2026 verdict — Crowell & Moring legal analysis, Axios coverage, Boston Globe
- Fee breakdown — The Hustle's "Sneaky Economics of Ticketmaster," NGPF analysis showing 28% average
- Ticketmaster's own fee defense blog — useful to link as the counter-narrative
- DOJ settlement terms (15% cap, 13 amphitheater divestitures) — cite Crowell & Moring
- Supabase pricing — supabase.com/pricing for the receipts on $0 free tier
- Stripe fees — stripe.com/pricing for 2.9% + 30¢

---

## What you don't need to mention (save for later content)

- The architecture (separate video — "Designing a ticketing platform")
- The technical stack details (separate video — Slice 1 build day)
- Privy / Solana / NFTs / smart contracts (separate video — Slice 5)
- The white-label / consulting offer (let it emerge organically when venues reach out)
- The DAO / Mixt Collective / governance token (way later, don't muddy the waters)

This post is the *story*. The build is the *evidence*. Don't confuse them.
