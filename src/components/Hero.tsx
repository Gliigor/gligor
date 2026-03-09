import { ArrowRight } from "lucide-react";

const Hero = () => {
  return (
    <section
      className="flex flex-col items-center justify-center px-6 relative z-10"
      style={{ paddingTop: "120px", paddingBottom: "64px" }}
    >
      <style>{`
        @keyframes terminalBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .terminal-cursor {
          animation: terminalBlink 1.1s step-end infinite;
          color: #00ff41;
          font-style: normal;
        }
        .hacker-name {
          font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Courier New', monospace;
          font-style: italic;
          font-weight: 700;
          color: #e2e8f0;
          text-shadow:
            0 0 8px #00ff41,
            0 0 20px #00ff4144,
            0 0 40px #00ff4122;
          letter-spacing: 0.04em;
        }
      `}</style>

      {/* Logo orb */}
      <div
        className="relative mb-7 animate-fade-in animate-float"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl scale-150" />
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-primary/30 flex items-center justify-center relative backdrop-blur-sm bg-secondary/30">
          <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-full border border-primary/20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary/60 glow-primary" />
          </div>
        </div>
      </div>

      {/* Name */}
      <h1
        className="hacker-name text-3xl sm:text-4xl md:text-5xl mb-4 animate-fade-up"
        style={{ animationDelay: "0.3s" }}
      >
        Gligor Jancev<span className="terminal-cursor">▮</span>
      </h1>

      {/* Primary tagline — honest and specific */}
      <p
        className="text-base sm:text-lg text-foreground/80 font-medium text-center mb-3 animate-fade-up tracking-wide"
        style={{ animationDelay: "0.4s", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      >
        I build tools I actually use.
      </p>

      {/* Supporting copy */}
      <p
        className="text-sm sm:text-base text-muted-foreground max-w-md text-center mb-8 animate-fade-up leading-relaxed"
        style={{ animationDelay: "0.5s" }}
      >
        Three working personal finance tools — built out of frustration with apps
        that don't do exactly what I want. Open, fast, and no account required.
      </p>

      {/* CTA */}
      <button
        onClick={() => document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" })}
        className="group relative px-7 py-2.5 border border-primary/60 text-primary rounded-md tracking-widest text-xs uppercase transition-all duration-300 hover:bg-primary/10 hover:border-primary animate-fade-up flex items-center gap-3"
        style={{ animationDelay: "0.7s", background: "none", cursor: "pointer" }}
      >
        See the Tools
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
      </button>
    </section>
  );
};

export default Hero;
