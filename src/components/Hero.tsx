import { ArrowRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
      {/* Tagline */}
      <p
        className="text-[10px] sm:text-xs tracking-[0.35em] uppercase text-muted-foreground mb-10 animate-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        Reconnecting Signal • Digital System Reboot
      </p>

      {/* Logo placeholder */}
      <div
        className="relative mb-10 animate-fade-in animate-float"
        style={{ animationDelay: "0.4s" }}
      >
        {/* Glow behind */}
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl scale-150" />
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-primary/30 flex items-center justify-center relative backdrop-blur-sm bg-secondary/30">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-primary/20 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-primary/60 glow-primary" />
          </div>
        </div>
      </div>

      {/* RETURN headline */}
      <h1
        className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-[0.2em] mb-6 animate-fade-up"
        style={{ animationDelay: "0.5s", fontFamily: "'Orbitron', sans-serif" }}
      >
        RETURN<span className="animate-blink text-primary">|</span>
      </h1>

      {/* Name */}
      <h2
        className="text-lg sm:text-xl md:text-2xl tracking-[0.15em] text-foreground/80 mb-6 animate-fade-up"
        style={{ animationDelay: "0.65s", fontFamily: "'Orbitron', sans-serif" }}
      >
        Gligor Jancev
      </h2>

      {/* Subheadline */}
      <div
        className="text-center max-w-lg mx-auto mb-4 animate-fade-up"
        style={{ animationDelay: "0.8s" }}
      >
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed italic">
          "The channel went dark a long time ago. Years of static.
          <br />A signal returns. Same source. Different frequency."
        </p>
      </div>

      {/* Description */}
      <p
        className="text-sm sm:text-base text-muted-foreground max-w-md text-center mb-12 animate-fade-up leading-relaxed"
        style={{ animationDelay: "0.95s" }}
      >
        Passionate about AI, technology and the advancement of human technology.
        Loves to try new things. Take a look at my projects.
      </p>

      {/* CTA Button */}
      <a
        href="#projects"
        className="group relative px-8 py-3 border border-primary/60 text-primary rounded-md tracking-widest text-sm uppercase transition-all duration-300 hover:bg-primary/10 hover:border-primary hover:glow-primary animate-fade-up flex items-center gap-3"
        style={{ animationDelay: "1.1s" }}
      >
        Enter Projects
        <ArrowRight
          size={16}
          className="transition-transform group-hover:translate-x-1"
        />
      </a>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-fade-in"
        style={{ animationDelay: "1.5s" }}
      >
        <div className="w-5 h-8 border border-muted-foreground/40 rounded-full flex justify-center">
          <div className="w-1 h-2 bg-primary/60 rounded-full mt-1.5 animate-bounce" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
