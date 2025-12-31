import { Github, Linkedin, Mail } from "lucide-react";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xl font-semibold tracking-tight hover:text-primary transition-colors">
          dev<span className="text-primary">.</span>
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
            href="https://linkedin.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Linkedin size={20} />
          </a>
          <a 
            href="mailto:hello@example.com"
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
