const About = () => {
  return (
    <section id="about" className="flex flex-col items-center px-6 py-16 relative z-10">
      <div className="w-full max-w-4xl">
        <div className="border border-border/60 rounded-lg p-8 bg-card/40 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Left: label */}
            <div className="sm:w-36 shrink-0">
              <p className="text-xs tracking-[0.25em] text-primary/60 uppercase mb-1">About</p>
              <div className="h-px w-8 bg-primary/30" />
            </div>

            {/* Right: bio */}
            <div className="flex-1">
              <p className="text-foreground/90 text-sm sm:text-base leading-relaxed mb-4">
                I'm Gligor, a developer based in the Netherlands with a focus on building
                practical tools that solve real problems — starting with my own. When I couldn't
                find a budgeting app that worked exactly the way I think, I built one.
                Then another. Then a third.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                I work across the full stack but spend most of my time in TypeScript and React.
                These finance tools are built without backend infrastructure — everything runs
                in the browser, your data stays on your device.
              </p>

              {/* Stack pills */}
              <div className="flex flex-wrap gap-2">
                {["TypeScript", "React", "Tailwind CSS", "Vite", "Node.js"].map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 text-[10px] tracking-wider uppercase font-medium bg-secondary/60 text-muted-foreground rounded-full border border-border/40"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
