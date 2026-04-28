import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      {/* Hero */}
      <section className="bg-brand text-white">
        <div className="max-w-4xl mx-auto px-4 py-24 md:py-32">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent mb-4">
            Safety-first route generation
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5 tracking-tight">
            Run safer in<br />unfamiliar areas
          </h1>
          <p className="text-base md:text-lg text-white/60 max-w-lg mb-10 leading-relaxed">
            SafeRun generates running routes that prioritise your safety using UK Police crime data
            and environmental safety metrics.
          </p>
          <div className="flex items-center gap-3">
            <Link
              to={user ? '/dashboard' : '/signup'}
              className="btn-primary bg-accent hover:bg-accent-light text-white px-8 py-3.5 text-sm font-semibold inline-block"
            >
              {user ? 'Go to Dashboard' : 'Get Started'}
            </Link>
            {!user && (
              <Link
                to="/login"
                className="text-sm font-semibold text-white/60 hover:text-white px-6 py-3.5 border border-white/20 hover:border-white/40 inline-block transition-all duration-200"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent mb-3">How it works</p>
        <h2 className="text-2xl font-bold text-brand mb-12">Three simple steps</h2>

        <div className="grid md:grid-cols-3 gap-0 border border-border">
          <Step
            number="01"
            title="Pick location"
            description="Click on the map or use your current location to set a starting point anywhere in London."
            border
          />
          <Step
            number="02"
            title="Set preferences"
            description="Choose distance, safety priority, and toggle options like preferring well-lit areas."
            border
          />
          <Step
            number="03"
            title="Get safe route"
            description="Our algorithm analyses crime data and environmental factors to find the safest running loop."
          />
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-border">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent mb-3">Features</p>
          <h2 className="text-2xl font-bold text-brand mb-12">Why SafeRun</h2>

          <div className="grid md:grid-cols-2 gap-px bg-border">
            <Feature
              title="Data-driven safety"
              description="Routes scored using real UK Police crime data and London SafeStats environmental indicators."
            />
            <Feature
              title="Transparent explanations"
              description="Every route comes with clear, positive-framed explanations of why it was selected."
            />
            <Feature
              title="Customisable preferences"
              description="Adjust safety priority, distance, and preferences like avoiding parks after dark."
            />
            <Feature
              title="Route regeneration"
              description="Not happy with a route? Regenerate to get a different safe option each time."
            />
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <div className="border border-border bg-white p-6 text-sm text-text-secondary leading-relaxed">
          <p className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">Disclaimer</p>
          SafeRun suggests routes based on publicly available data from the UK Police API and London
          Datastore. This is a risk-reduction tool and does not guarantee safety. Routes are
          suggestions only, always use your own judgement and be aware of your surroundings when
          running.
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand text-white/40 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs">
          SafeRun &mdash; Safety-first route generation for runners
        </div>
      </footer>
    </div>
  );
}

function Step({ number, title, description, border }) {
  return (
    <div className={`p-6 ${border ? 'md:border-r border-b md:border-b-0 border-border' : ''}`}>
      <div className="text-xs font-bold text-accent mb-3">{number}</div>
      <h3 className="text-base font-bold text-brand mb-2">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function Feature({ title, description }) {
  return (
    <div className="bg-white p-6">
      <h3 className="text-sm font-bold text-brand mb-1.5">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}
