import { Github, Mail } from "lucide-react";

const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xl font-semibold tracking-tight hover:text-primary transition-colors">
          gligor<span className="text-primary">.</span>xyz
        </a>
        
        <nav className="flex items-center gap-6">
          <a 
            href="#projects" 
            className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
          >
            Projects
          </a>
          <a 
            href="#about" 
            className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
          >
            About
          </a>
          <a 
            href="#contact" 
            className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
          >
            Contact
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github size={20} />
          </a>
          <a 
            href="https://x.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon size={18} />
          </a>
          <a 
            href="mailto:gligor@jancev.com"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail size={20} />
          </a>
        </div>
      </div>
    </header>
  );
};

export default Header;
