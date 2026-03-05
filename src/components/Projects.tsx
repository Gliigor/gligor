import { ExternalLink, Github } from "lucide-react";

const projects = [
  {
    title: "CSV Dashboard Tool",
    description:
      "Upload bank CSV exports and analyze spending per category and month. Visual breakdowns with charts and filters.",
    tags: ["React", "TypeScript", "Tailwind", "Charts"],
    githubUrl: "https://github.com",
    liveUrl: "https://gligor.xyz/csv-dashboard",
  },
];

const Projects = () => {
  return (
    <section id="projects" className="min-h-screen flex flex-col items-center justify-center px-6 py-24 relative z-10">
      <div className="w-full max-w-4xl">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs tracking-[0.25em] text-primary/60 mb-3 uppercase">Signal Log</p>
          <h2 className="text-4xl font-bold text-foreground mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Projects
          </h2>
          <p className="text-muted-foreground text-sm">
            A collection of tools and experiments built along the way.
          </p>
        </div>

        {/* Project cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project, index) => (
            <a
              key={project.title}
              href={project.liveUrl}
              className="block"
            >
              <article
                className="group border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500 cursor-pointer h-full"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3
                    className="text-base font-semibold tracking-wider group-hover:text-primary transition-colors"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    {project.title}
                  </h3>
                  <div className="flex items-center gap-3">
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

        {/* Footer contact */}
        <div className="mt-24 pt-12 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Open Channel</h3>
            <p className="text-muted-foreground text-sm">Transmit a signal. Let's connect.</p>
          </div>
          <a
            href="mailto:gligor@jancev.com"
            className="px-6 py-3 border border-primary/50 text-primary rounded-md tracking-widest text-xs uppercase hover:bg-primary/10 transition-all duration-300"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            gligor@jancev.com
          </a>
        </div>
      </div>
    </section>
  );
};

export default Projects;
