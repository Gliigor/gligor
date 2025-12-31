const Footer = () => {
  return (
    <footer id="contact" className="py-16 px-6 border-t border-border">
      <div className="container mx-auto max-w-5xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-semibold mb-2">Let's connect</h3>
            <p className="text-muted-foreground">
              Open to opportunities and interesting projects.
            </p>
          </div>
          
          <a 
            href="mailto:gligor@jancev.com"
            className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all glow-primary hover:scale-105"
          >
            gligor@jancev.com
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2024 All rights reserved.</p>
          <p>Built with React & Tailwind CSS</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
