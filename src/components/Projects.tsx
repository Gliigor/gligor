import ProjectCard from "./ProjectCard";

const projects = [
  {
    title: "Task Flow",
    description: "A modern task management application with real-time collaboration, drag-and-drop functionality, and smart scheduling features.",
    tags: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    githubUrl: "https://github.com",
    liveUrl: "https://example.com",
  },
  {
    title: "Code Metrics",
    description: "Analytics dashboard for tracking code quality, test coverage, and development velocity across multiple repositories.",
    tags: ["Next.js", "GraphQL", "D3.js", "Tailwind"],
    githubUrl: "https://github.com",
    liveUrl: "https://example.com",
  },
  {
    title: "DevSync",
    description: "Real-time code synchronization tool for remote pair programming sessions with built-in video chat and terminal sharing.",
    tags: ["WebRTC", "Socket.io", "Express", "Monaco"],
    githubUrl: "https://github.com",
  },
  {
    title: "API Gateway",
    description: "Lightweight API gateway with rate limiting, caching, and request transformation capabilities for microservices architecture.",
    tags: ["Go", "Redis", "Docker", "Kubernetes"],
    githubUrl: "https://github.com",
  },
];

const Projects = () => {
  return (
    <section id="projects" className="py-24 px-6">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-12 animate-fade-up">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Featured Projects
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            A selection of projects I've worked on, from full-stack applications to developer tools and open-source contributions.
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
