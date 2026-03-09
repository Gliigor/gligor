const LoadingScreen = () => {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0f0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes orbPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .loading-orb {
          animation: orbPulse 1.8s ease-in-out infinite;
        }
        .loading-text {
          animation: fadeInUp 0.6s ease forwards;
          animation-delay: 0.2s;
          opacity: 0;
        }
      `}</style>

      <div className="loading-orb" style={{ position: "relative", marginBottom: "20px" }}>
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "rgba(0,255,65,0.08)",
          filter: "blur(20px)",
          transform: "scale(1.5)",
        }} />
        <div style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "1px solid rgba(0,255,65,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,255,65,0.05)",
          position: "relative",
        }}>
          <div style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "rgba(0,255,65,0.6)",
            boxShadow: "0 0 12px #00ff41",
          }} />
        </div>
      </div>

      <p className="loading-text" style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: "11px",
        letterSpacing: "0.2em",
        color: "rgba(0,255,65,0.5)",
        textTransform: "uppercase",
      }}>
        gligor.xyz
      </p>
    </div>
  );
};

export default LoadingScreen;
