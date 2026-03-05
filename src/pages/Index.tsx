import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Projects from "@/components/Projects";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      <ConstellationBackground />
      <Header />
      <main>
        <Hero />
        <Projects />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
