"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      style={{
        position: "fixed",
        right: 16,
        bottom: "calc(var(--nav-height) + var(--safe-bottom) + 16px)",
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "var(--accent-sage)",
        color: "white",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 40,
        opacity: visible ? 0.9 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 300ms ease",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <ChevronUp size={20} />
    </button>
  );
}
