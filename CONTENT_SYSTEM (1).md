# Ship Tickets — Content Production System

**Owner:** Justin / Mixt Labs
**Status:** Pre-launch, system design
**Last updated:** 2026-05-14

Companion document to `CLAUDE.md`. Where CLAUDE.md is the project plan, this is the content production pipeline that turns the build into an audience.

The premise: one focused build day produces enough raw material to fuel a full week of content across every channel. Not by working harder — by treating the long-form video as the master and using AI to derive every other format from it.

---

## 1. Audience and voice

### Who this is for
The audience is **curious operators**, not engineers. People who:
- Run small businesses, throw events, or work in adjacent industries (music, hospitality, creator economy)
- Have heard about AI tools but haven't seen what an actual person does with them daily
- Are smart but don't speak fluent dev — they want concepts, not jargon
- Want to feel the leverage AI gives one person, not be lectured about it

This is a much bigger audience than dev Twitter. It's also currently underserved because most tech content is made by career engineers for other engineers.

### The voice
- **Operator, not academic.** "I tried this and it broke" beats "the theoretical implications of..."
- **Story-first, concept-second.** Every video starts with a specific moment, not a concept overview.
- **Honest about failure.** The Mix Tickets origin story is the foundation — getting crushed by a SaaS vendor is more compelling than another success story.
- **Show the leverage, don't claim it.** A clip of four Claude agents executing in parallel while you walk to grab coffee is worth 1,000 words about AI productivity.
- **Sentence case, not Title Case.** Captions and thumbnails included. Avoid "Here's What Happened" energy. Use "here's what happened."

### What the voice is NOT
- "AI is going to change everything" hype with no specifics
- Code walkthroughs aimed at engineers
- Tutorial-style "step 1, step 2" content (boring, low retention)
- Doomer takes about AI replacing humans (kills the through-line that AI offloads boring work so humans do creative work)

---

## 2. The long-form template

Every build day produces one 15–25 minute master video. Same structure every time so the brain doesn't have to invent it fresh:

| Segment | Duration | Purpose |
|---------|----------|---------|
| **Cold open** | 15–30 sec | The surprising claim or moment. Hook for both the long-form and the standalone short. |
| **Story setup** | 1–2 min | Where we are in the project, what went wrong before, why today matters. The "previously on..." beat. |
| **Today's goal** | 30 sec | One clear sentence stating what you're going to build. No fluff. |
| **The work** | 10–20 min | Show + tell. Screen share, face cam corner, voice-over the decisions. Cut to AI agents doing parallel work. |
| **Big idea moment** | 1–2 min | One callout segment per video where you stop and explain the *why* in normie terms. This is the short-form gold. |
| **Day recap** | 1 min | What shipped, what's next, where the repo is. End with a hook for the next video. |

Each segment is **self-contained** so it can stand alone as a short. The Big Idea Moment is the one you over-invest in — that's the segment that travels.

---

## 3. Tool stack

### Capture
- **OBS Studio** (free) — screen + webcam recording, scene switching. Powerful but takes one afternoon to set up.
- **Descript** ($24/mo) — alternative that records *and* transcribes in one app. Easier starting point if OBS feels heavy.
- **Wispr Flow** ($15/mo) — voice-to-text into any field. Capture big-idea moments mid-build without context-switching. Essential.
- **Loom** (free tier) — quick screen records for one-off shorts or DM responses.

### Edit (long-form master)
- **Descript** — transcript-based editing is the unlock. Delete a word in the transcript, the video deletes. Removes filler words automatically. Generates captions. Replaces a video editor.
- **CapCut Desktop** (free) — backup for things Descript can't do well (complex animations, motion graphics).

### Extract (short-form)
- **Opus Clip** (~$19/mo) — uploads the long-form, picks viral moments, formats vertical, adds captions, scores virality. Spot-check, don't edit from scratch.
- **Submagic** (~$16/mo) — alternative or supplement, very good at trendy caption styles.
- **Descript** — also does short extraction if Opus Clip output isn't landing.

### Write (text outputs)
- **Claude** (you're using it) — long-form blog post drafts from the transcript, X thread drafts, newsletter copy. Feed it the transcript, ask for the format.
- **Typefully** (~$13/mo) — drafts and schedules X threads with engagement analytics.
- **Substack** (free) — the newsletter home. Long-form blog posts cross-post here automatically.

### Visualize
- **Midjourney** ($10–$30/mo) — thumbnails, B-roll concept images, social cards.
- **Flux via Replicate** (pay per use) — open-source alternative, often better for technical/architectural images.
- **Claude artifacts/diagrams** — the architecture and pipeline diagrams in our chats render cleanly at high resolution. Screenshot, drop into the video as B-roll.

### Distribute
- **Buffer** or **Hypefury** (~$15–$30/mo) — schedule everything once, fans out to YouTube, TikTok, Reels, X, LinkedIn.
- **Make.com** (free tier covers it) — automation glue if Buffer doesn't reach a platform you need (e.g., posting to Substack from a Notion doc).

### Total monthly cost ceiling
Around **$100/mo all-in** for the entire stack at the levels above. Compare to hiring an editor (~$2k/mo) or a content manager (~$5k/mo). The ROI is silly.

---

## 4. The workflow (one build day → one week of content)

### Morning — plan
- 20 min: review CLAUDE.md, pick the slice, define today's deliverable
- 10 min: set up OBS scenes (or just open Descript), test mic
- Wispr Flow open in the background all day

### Build session (3–6 hrs)
- Hit record before starting
- Talk through what you're doing as you do it — like explaining to a smart friend who's not technical
- Spin up Claude Code agents on parallel features when applicable (great B-roll opportunity)
- Capture big-idea moments via Wispr Flow into a running Notes doc
- Don't stop to edit. Bad takes stay. Retakes happen by saying "let me say that again" — Descript drops the bad version.

### Edit (60–90 min)
1. Drop the raw recording into Descript
2. Auto-remove filler words (one click)
3. Delete obviously dead sections by deleting transcript lines
4. Add chapter markers at segment boundaries
5. Generate captions (auto)
6. Add the cold open clip (you can record this *after* you know what the video is actually about)
7. Export the master long-form

### Derive (30–45 min)
1. Upload master to Opus Clip, let it generate 5–10 shorts. Spot-check, accept 3–5.
2. Feed transcript to Claude: "Turn this into an X thread, 8 tweets, voice should be casual operator, no hashtags."
3. Feed transcript to Claude: "Turn this into a 600-word blog post for a curious-normie audience."
4. Generate a thumbnail in Midjourney (or use a Claude diagram screenshot).

### Distribute (15 min)
- Schedule the long-form on YouTube for a peak time
- Schedule shorts staggered across TikTok / Reels / Shorts over the next 3–4 days
- Schedule X thread for next morning
- Publish blog post on Substack, queue for newsletter
- Cross-post a teaser thread on LinkedIn

**Total post-build time: ~2 hours.** Output: one long-form, 3–5 shorts, one thread, one blog post, one newsletter issue. That's a full week of content from a single build day.

---

## 5. Production discipline rules

These rules exist because the system fails when discipline slips, not when tools fail.

1. **Long-form is always made first.** Never make a short directly. Even if you're shooting a one-off, treat it as a long-form fragment that happens to be short — record context around it, then chop.
2. **One topic per video.** Cramming two features into one video kills the shorts because the hooks compete. If today is "auth setup," it's only auth setup.
3. **Hit record before knowing what you'll say.** Pre-scripting kills the authenticity that the audience comes for. Edit in post.
4. **Bad takes stay in the recording.** Retake by saying "let me say that again." Delete the bad version in Descript. Stopping and re-recording wastes time and energy.
5. **Always have one Big Idea Moment per video.** If you can't identify it during editing, you didn't make one. Re-record a 60-second standalone segment and splice it in.
6. **Captions on every short, always.** ~85% of mobile video plays muted. No captions = no views.
7. **Sentence case in every caption, title, and thumbnail.** "How i built ticketing on supabase" not "How I Built Ticketing On Supabase". The aesthetic difference is real.
8. **Same intro/outro music across the series.** Recognition matters more than novelty. Pick one track in week one, never change it.
9. **Don't read comments during a build day.** Replies go in batches — once after morning post, once at end of day. Otherwise the loop eats focus.
10. **Ship even when the build day was unproductive.** A video about why today didn't work and what you learned is better than no video. Consistency builds the audience; perfectionism kills it.

---

## 6. Distribution channels and cadence

### Primary
- **YouTube long-form** — the actual archive. The home everything else points back to. 1–2 per week.
- **X (formerly Twitter)** — daily presence, threads from each long-form, real-time updates during build sessions.
- **TikTok / Instagram Reels / YouTube Shorts** — the shorts derived from each long-form, staggered across the week. 3–5 per week per platform.

### Secondary
- **Substack newsletter** — weekly summary, "what I built this week," subscribers are the most valuable audience.
- **LinkedIn** — the same posts that work on X work surprisingly well on LinkedIn when reformatted slightly (no slang, more direct).

### Don't bother with (for now)
- Bluesky / Threads / other smaller platforms — marginal reach, real maintenance cost
- Podcast — eventually yes, but it's a different production system; don't try to start it in the first 3 months
- Discord / community-building — not until there's an audience to gather

### Cadence
Week one: just hit "publish" on one video. Get the loop working end-to-end before optimizing volume.
Week 2–4: one long-form per week, derivatives staggered across the week.
Month 2+: scale to two long-forms per week if the system is humming. Otherwise keep one and improve quality.

---

## 7. First-week launch sequence

### Day 0 — Origin post
- 600–900 word blog post on Substack: "I tried to take down Ticketmaster in 2022. Here's what happened, and why I'm rebuilding it for free."
- Tell the full Mix Tickets story honestly. The GET Protocol partnership. The lock-in. The lessons. The new approach.
- This is the only piece of content where you're not building yet. It exists to give context for everything that follows.
- Cross-post: X thread version, LinkedIn version.

### Day 1 — Architecture day (filmed)
- Long-form: "Designing a ticketing platform that any small venue can self-host"
- Topics: the three-tier model, why Supabase + Vercel, why open source
- Show the architecture diagram, walk through it conversationally
- Big Idea Moment: "Why a small venue should never need AWS to ship tickets"

### Day 2 — Slice 1 day (filmed)
- Long-form: "Day one of the build — auth, deploy pipeline, and the repo goes public"
- Show the monorepo coming together, Privy login working, the deploy hitting Vercel for the first time
- Big Idea Moment: "Why I made the repo public on day one and not day ninety"

### Day 3 — Derivatives ship
- 3–5 shorts from Day 1 and Day 2 long-forms
- X thread from each
- Blog posts cross-posted to Substack

### Day 4–7 — Slice 2 begins
- Continue the loop

By end of week one: 2 long-forms, ~10 shorts, 2 threads, 3 blog posts, a public repo, and a beginning audience.

---

## 8. What "the system" actually is

The point of all this isn't to be a content creator. It's to make the build legible and let the work speak. The system exists because:

- Without a system, content production eats build time and the project dies
- Without distribution, the build never finds an audience and Mixt Labs stays invisible
- With both, one person produces what used to require a team of 4 (engineer, editor, social manager, copywriter)

The system is the proof of the thesis. **A solo operator + AI = a small team's output.** Every video you ship is evidence. Every short someone watches is a recruit for the worldview that one person can do this now, with these tools, at this cost.

That's the *real* product. Ship Tickets is the demo.

---

## 9. What to NOT spend time on

- **Perfect thumbnails.** Get them 80% right and move on. Iterate after 20 videos based on what actually performs.
- **Custom intros longer than 5 seconds.** No one watches them. Skip-the-intro behavior is universal.
- **Trying to grow on every platform from day one.** Pick YouTube + X for the first 30 days. Add TikTok in month two. Add LinkedIn whenever. Don't fragment focus.
- **Engagement farming.** No "comment YES if you agree" begging. No fake controversy. The work is interesting; let it be interesting.
- **Worrying about haters.** The audience for honest operator content is huge and the haters self-select out. Mute liberally.
- **Comparing to creators with full teams.** They have full teams. You're proving the opposite point.

---

## 10. Iterating on this document

This is a v1 system. After 30 videos:
- Which segments retained best? Adjust the template.
- Which shorts performed best? Lean into those formats.
- Which tools earned their cost? Cut the rest.
- What's the actual time-per-video? Compress the bottlenecks.

Update this doc the same way CLAUDE.md gets updated — when the system materially changes, edit and commit. The doc travels with the work.
