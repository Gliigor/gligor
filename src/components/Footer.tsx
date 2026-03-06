const Footer = () => {
  return (
    <footer id="contact" className="relative z-10 border-t border-border/30">
      <div className="max-w-4xl mx-auto px-6 py-16 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Open Channel</h3>
          <p className="text-muted-foreground text-sm">Transmit a signal. Let's connect.</p>
        </div>
        <a
          href="mailto:gligor@jancev.com"
          className="px-6 py-3 border border-primary/50 text-primary rounded-md tracking-widest text-xs uppercase hover:bg-primary/10 transition-all duration-300"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          gligor@jancev.com
        </a>
      </div>
      <div className="text-center pb-6 text-xs text-muted-foreground/40 tracking-widest">
        © {new Date().getFullYear()} gligor.xyz
      </div>
    </footer>
  );
};

export default Footer;
