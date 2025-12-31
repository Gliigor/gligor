const Hero = () => {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center pt-20 px-6 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl animate-pulse-glow pointer-events-none" />
      
      <div className="text-center max-w-3xl mx-auto relative z-10">
        <p className="text-primary text-sm font-medium tracking-widest uppercase mb-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Software Developer
        </p>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <span className="text-gradient">Building digital</span>
          <br />
          <span className="text-foreground">experiences</span>
        </h1>
        
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          Passionate about creating clean, efficient, and user-focused applications. 
          Specializing in modern web technologies and scalable solutions.
        </p>
        
        <div className="flex items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <a 
            href="#projects"
            className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all glow-primary hover:scale-105"
          >
            View Projects
          </a>
          <a 
            href="#contact"
            className="px-6 py-3 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80 transition-all border border-border hover:border-muted-foreground"
          >
            Get in Touch
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-fade-in" style={{ animationDelay: '0.8s' }}>
        <div className="w-6 h-10 border-2 border-muted-foreground rounded-full flex justify-center">
          <div className="w-1.5 h-3 bg-muted-foreground rounded-full mt-2 animate-bounce" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
