import { ExternalLink, Github } from "lucide-react";

const projects = [
  {
    title: "Net Worth Tracker",
    hook: "Know exactly where you stand financially — updated in real time.",
    description:
      "Track assets and liabilities with live stock and crypto prices pulled automatically. See your full portfolio allocation, performance over time, and daily balance snapshots. Built because most net worth apps require an account.",
    tags: ["React", "CoinGecko", "Yahoo Finance", "Charts"],
    githubUrl: "https://github.com",
    liveUrl: "/#/net-worth",
  },
  {
    title: "Budget Maker",
    hook: "Plan your month before it happens, not after.",
    description:
      "Set income sources and expense categories, see live totals and an allocation bar as you type. Saves automatically to your browser — no login, no sync, no subscription. Your numbers stay on your device.",
    tags: ["React", "TypeScript", "Tailwind"],
    githubUrl: "https://github.com",
    liveUrl: "/#/budget-maker",
  },
  {
    title: "CSV Dashboard",
    hook: "Upload your BUNQ export and see where your money actually goes.",
    description:
      "Drop in a bank CSV and get instant spending breakdowns by category and month. Transactions are auto-classified using Dutch merchant names. Useful for any BUNQ or ING export — no data leaves your browser.",
    tags: ["React", "TypeScript", "Tailwind", "Charts"],
    githubUrl: "https://github.com",
    liveUrl: "/#/csv-dashboard",
  },
];

const Projects = () => {
  return (
    <section id="projects" className="flex flex-col items-center px-6 pt-8 pb-16 relative z-10">
      <div className="w-full max-w-4xl">

        {/* Section header */}
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.25em] text-primary/60 mb-3 uppercase">Signal Log</p>
          <h2
            className="text-3xl font-bold text-foreground mb-3"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            Projects
          </h2>
          <p className="text-muted-foreground text-sm">
            Personal finance tools built for actual daily use.
          </p>
        </div>

        {/* Project cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((project, index) => (
            <a
              key={project.title}
              href={project.liveUrl}
              className={`block${index === 2 ? " md:col-span-2 md:max-w-lg md:mx-auto w-full" : ""}`}
            >
              <article
                className="group border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500 cursor-pointer h-full"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3
                    className="text-base font-semibold tracking-wider group-hover:text-primary transition-colors"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    {project.title}
                  </h3>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {project.githubUrl && (
                      <span
                        onClick={(e) => { e.preventDefault(); window.open(project.githubUrl, "_blank"); }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Github size={16} />
                      </span>
                    )}
                    {project.liveUrl && (
                      <span className="text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink size={16} />
                      </span>
                    )}
                  </div>
                </div>

                {/* One-line hook */}
                <p className="text-primary/70 text-xs mb-3 font-medium tracking-wide">
                  {project.hook}
                </p>

                <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                  {project.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 text-[10px] tracking-wider uppercase font-medium bg-secondary/60 text-muted-foreground rounded-full border border-border/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Projects;
