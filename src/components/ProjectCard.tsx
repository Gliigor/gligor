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
      className="group card-gradient border border-border rounded-xl p-6 hover:border-muted-foreground/50 transition-all duration-300 hover:glow-subtle animate-fade-up"
      style={{ animationDelay: `${0.1 * index}s` }}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-3">
          {githubUrl && (
            <a 
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github size={18} />
            </a>
          )}
          {liveUrl && (
            <a 
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink size={18} />
            </a>
          )}
        </div>
      </div>
      
      <p className="text-muted-foreground mb-4 leading-relaxed">
        {description}
      </p>
      
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span 
            key={tag}
            className="px-3 py-1 text-xs font-medium bg-secondary text-muted-foreground rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
};

export default ProjectCard;
