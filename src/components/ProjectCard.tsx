import { ExternalLink, Github } from "lucide-react";

interface ProjectCardProps {
  title: string;
  description: string;
  tags: string[];
  githubUrl?: string;
  liveUrl?: string;
  index: number;
}

const ProjectCard = ({ title, description, tags, githubUrl, liveUrl, index }: ProjectCardProps) => {
  return (
    <article 
      className="group border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500 hover:glow-subtle animate-fade-up"
      style={{ animationDelay: `${0.1 * index}s` }}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-base font-semibold tracking-wider group-hover:text-primary transition-colors" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          {title}
        </h3>
        <div className="flex items-center gap-3">
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
              <Github size={16} />
            </a>
          )}
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>
      
      <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
        {description}
      </p>
      
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="px-3 py-1 text-[10px] tracking-wider uppercase font-medium bg-secondary/60 text-muted-foreground rounded-full border border-border/40">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
};

export default ProjectCard;
