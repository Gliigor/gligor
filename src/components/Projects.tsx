import ProjectCard from "./ProjectCard";

const projects = [
  {
    title: "CSV Dashboard Tool",
    description: "Upload bank CSV exports and analyze spending per category and month. Visual breakdowns with charts and filters.",
    tags: ["React", "TypeScript", "Tailwind", "Charts"],
    githubUrl: "https://github.com",
    liveUrl: "https://example.com",
  },
];

const Projects = () => {
  return (
    <section id="projects" className="py-24 px-6 relative z-10">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-12 animate-fade-up text-center">
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
            Signal Log
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-wider mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Projects
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            A collection of tools and experiments built along the way.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {projects.map((project, index) => (
            <ProjectCard key={project.title} {...project} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Projects;
