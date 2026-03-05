import { ArrowRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
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

      {/* Name headline */}
      <h1
        className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-[0.15em] mb-8 animate-fade-up"
        style={{ animationDelay: "0.5s", fontFamily: "'Orbitron', sans-serif" }}
      >
        Gligor Jancev<span className="animate-blink text-primary">|</span>
      </h1>

      {/* Description */}
      <p
        className="text-sm sm:text-base text-muted-foreground max-w-md text-center mb-12 animate-fade-up leading-relaxed"
        style={{ animationDelay: "0.7s" }}
      >
        Passionate about AI, technology, and pushing human innovation forward. I love experimenting with new ideas and building things. Feel free to explore my projects.
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
