const principles = [
  {
    number: "01",
    title: "Free to run your own",
    body: "Self-host the same codebase with no Ship Tickets platform fee. Your venue, your data, your rails.",
  },
  {
    number: "02",
    title: "Simple when hosted",
    body: "Mixt Hosted handles infrastructure and support for a flat $2.22 per paid ticket. Free events stay free.",
  },
  {
    number: "03",
    title: "Fair at the door",
    body: "Account-bound tickets, rotating QR codes, and organizer-controlled resale make scalping harder by design.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grid-field pointer-events-none absolute inset-0 opacity-35" />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 sm:px-10 lg:px-16">
        <nav className="flex h-24 items-center justify-between border-b border-white/10">
          <a
            className="flex items-center gap-3"
            href="#top"
            aria-label="Ship Tickets home"
          >
            <span className="grid size-8 place-items-center rounded-full border border-[#d6ff65]/50 bg-[#d6ff65]/10 text-sm text-[#d6ff65]">
              ↗
            </span>
            <span className="text-sm font-semibold tracking-[0.18em]">
              SHIP TICKETS
            </span>
          </a>
          <a
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-[#d8d7cf] transition hover:border-[#d6ff65]/60 hover:text-[#d6ff65]"
            href="https://github.com/Rendurdreams/ship-tickets"
          >
            View source ↗
          </a>
        </nav>

        <section
          id="top"
          className="grid min-h-[72vh] items-center py-20 lg:grid-cols-[1.25fr_0.75fr] lg:gap-20"
        >
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#d6ff65]/20 bg-[#d6ff65]/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[#d6ff65]">
              <span className="size-1.5 rounded-full bg-[#d6ff65] shadow-[0_0_18px_#d6ff65]" />
              Open source from day one
            </div>
            <h1 className="max-w-5xl text-6xl font-medium leading-[0.92] tracking-[-0.06em] sm:text-7xl lg:text-[7.5rem]">
              Fair ticketing.
              <span className="block text-[#d6ff65]">Open rails.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#aaa9a0] sm:text-xl">
              A modular ticketing platform for independent venues, DIY
              organizers, and the fans who should not pay for unnecessary
              middlemen.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                className="rounded-full bg-[#d6ff65] px-7 py-3.5 text-center text-sm font-semibold text-[#11130d] transition hover:bg-[#e1ff91]"
                href="https://github.com/Rendurdreams/ship-tickets"
              >
                Follow the public build
              </a>
              <a
                className="rounded-full border border-white/15 px-7 py-3.5 text-center text-sm font-semibold text-[#e7e4da] transition hover:border-white/35"
                href="/api/health"
              >
                Check the live skeleton
              </a>
            </div>
          </div>

          <aside className="mt-16 border-l border-white/10 pl-8 lg:mt-0">
            <p className="text-xs uppercase tracking-[0.18em] text-[#77786f]">
              Foundation status
            </p>
            <div className="mt-6 space-y-6">
              <div>
                <p className="text-4xl font-medium tracking-[-0.04em]">$0</p>
                <p className="mt-1 text-sm text-[#888980]">
                  self-hosted platform fee
                </p>
              </div>
              <div className="border-t border-white/10 pt-6">
                <p className="text-4xl font-medium tracking-[-0.04em]">$2.22</p>
                <p className="mt-1 text-sm text-[#888980]">
                  per paid Mixt Hosted ticket
                </p>
              </div>
              <div className="border-t border-white/10 pt-6">
                <p className="text-4xl font-medium tracking-[-0.04em]">1</p>
                <p className="mt-1 text-sm text-[#888980]">
                  open codebase for every mode
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="border-t border-white/10 py-20">
          <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#d6ff65]">
                The contract
              </p>
              <h2 className="mt-3 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">
                Built for the show, not the tollbooth.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#8c8d84]">
              The first milestone is a complete free-event path: organizer to
              buyer to scanner.
            </p>
          </div>

          <div className="grid border-y border-white/10 md:grid-cols-3">
            {principles.map((principle) => (
              <article
                className="border-white/10 py-8 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0"
                key={principle.number}
              >
                <p className="font-mono text-xs text-[#6f7168]">
                  {principle.number}
                </p>
                <h3 className="mt-8 text-xl font-medium">{principle.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[#92938a]">
                  {principle.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-4 border-t border-white/10 pt-8 text-xs uppercase tracking-[0.14em] text-[#696b63] sm:flex-row">
          <p>Mixt Labs · built in public</p>
          <p>Apache 2.0 · foundations underway</p>
        </footer>
      </div>
    </main>
  );
}
