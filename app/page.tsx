import CinematicScene from '@/templates/cinematic-scroll/CinematicScene';

const phases = [
  { n: '01', title: 'Pre-construction & feasibility', body: 'Lot review, budget envelope, schematic design.' },
  { n: '02', title: 'Design & engineering', body: 'Architectural set, structural calcs, MEP routing.' },
  { n: '03', title: 'Permitting & zoning', body: 'Township submittal, variance if required, plan check.' },
  { n: '04', title: 'Foundation & framing', body: 'IRC-compliant, AHJ-inspected, weather-tight envelope.' },
  { n: '05', title: 'Rough-ins & finishes', body: 'MEP, insulation, drywall, trim, cabinetry, paint.' },
  { n: '06', title: 'Punch list & CO', body: 'Final walk, Certificate of Occupancy, keys delivered.' },
];

const trust = [
  { k: 'Licensed & insured', v: 'GC license active in every state we build in. $2M general liability and full workers’ comp on every site.' },
  { k: 'NAHB member', v: 'Active member of the National Association of Home Builders and our local Home Builders Association.' },
  { k: '2-10 Warranty', v: 'Every home delivered with a 1-year workmanship, 2-year systems, and 10-year structural warranty.' },
  { k: 'ENERGY STAR certified', v: 'Third-party HERS rating on every new build. Blower-door and duct-leakage tested at completion.' },
];

const services = [
  { title: 'Custom homes', body: 'Ground-up residential builds on your lot or ours. Architecture, structural engineering, MEP, and finish carpentry under one contract.' },
  { title: 'Additions & ADUs', body: 'Second-story pops, primary-suite additions, detached accessory dwellings. Designed to read like they were always there.' },
  { title: 'Whole-house renovation', body: 'Down-to-the-studs remodels with envelope, MEP, and finish upgrades on a single schedule.' },
];

export default function Home() {
  return (
    <main>
      <CinematicScene />

      <section className="sec sec--services" id="services">
        <header className="sec__head">
          <p className="sec__eyebrow">What we build</p>
          <h2 className="sec__title">Three doors in.</h2>
        </header>
        <ul className="cards">
          {services.map((s) => (
            <li key={s.title} className="card">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="sec sec--process" id="process">
        <header className="sec__head">
          <p className="sec__eyebrow">From contract to keys</p>
          <h2 className="sec__title">Six phases. One superintendent.</h2>
        </header>
        <ol className="phases">
          {phases.map((p) => (
            <li key={p.n} className="phase">
              <span className="phase__n">{p.n}</span>
              <div>
                <h3 className="phase__title">{p.title}</h3>
                <p className="phase__body">{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="sec sec--trust" id="trust">
        <header className="sec__head">
          <p className="sec__eyebrow">How you’re protected</p>
          <h2 className="sec__title">The boring, important parts.</h2>
        </header>
        <ul className="trust">
          {trust.map((t) => (
            <li key={t.k} className="trust__item">
              <h3>{t.k}</h3>
              <p>{t.v}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="sec sec--cta" id="contact">
        <h2 className="cta__title">Have a lot, a tear-down, or a sketch on a napkin?</h2>
        <p className="cta__body">Send the address and a few photos. We’ll come out for a site walk and a no-obligation feasibility conversation.</p>
        <a className="cta__btn" href="mailto:hello@keelstone.build?subject=Project%20inquiry">
          Start a project →
        </a>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Keelstone Residential</span>
        <span className="footer__meta">Custom homes · Additions · Whole-house renovation</span>
      </footer>
    </main>
  );
}
