const Footer = () => {
  return (
    <footer id="contact" className="py-16 px-6 border-t border-border/40 relative z-10">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-semibold tracking-wider mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Open Channel
            </h3>
            <p className="text-muted-foreground text-sm">
              Transmit a signal. Let's connect.
            </p>
          </div>
          
          <a 
            href="mailto:gligor@jancev.com"
            className="px-6 py-3 border border-primary/60 text-primary rounded-md tracking-widest text-xs uppercase transition-all duration-300 hover:bg-primary/10 hover:border-primary hover:glow-primary"
          >
            gligor@jancev.com
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground tracking-wider">
          <p>© 2024 All rights reserved.</p>
          <p className="uppercase tracking-[0.2em]">Signal Active</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
