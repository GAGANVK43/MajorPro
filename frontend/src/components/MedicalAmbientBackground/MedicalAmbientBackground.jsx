import { useEffect, useRef, useState } from "react";
import "./MedicalAmbientBackground.css";

/**
 * MedicalAmbientBackground
 * 
 * Premium, scientifically inspired animated background for DiaSense AI.
 * 
 * Features:
 * - Sparse medical neural network (drifting nodes with distance-based synaptic links)
 * - Micro data signal pulses traveling along active neural connections
 * - Floating medical data particles with gentle organic drift
 * - Faint decorative ECG-inspired waveform (calm, low-opacity, no fake vitals)
 * - Atmospheric scientific radial lighting & subtle depth glow fields
 * - Respects prefers-reduced-motion: reduce
 * - Pauses RAF loop when page is hidden (Page Visibility API)
 * - Strictly non-interactive (pointer-events: none, z-index: 0)
 */
export default function MedicalAmbientBackground() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // 1. Accessibility: Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handleMotionChange = (e) => {
      setReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMotionChange);
    } else {
      mediaQuery.addListener(handleMotionChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMotionChange);
      } else {
        mediaQuery.removeListener(handleMotionChange);
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId = null;
    let isTabVisible = !document.hidden;

    // Dimensions & DPR
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform before scaling
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();

    // Node & Particle Configuration based on screen size
    const getNodeCount = (w) => {
      if (w < 640) return 10;   // Mobile: very sparse & lightweight
      if (w < 1024) return 16;  // Tablet
      return 24;                // Desktop: balanced, clean, elegant
    };

    const getParticleCount = (w) => {
      if (w < 640) return 8;
      if (w < 1024) return 14;
      return 20;
    };

    const getConnectionDistance = (w) => {
      if (w < 640) return 105;
      if (w < 1024) return 135;
      return 165;
    };

    // Color definitions matching the prompt's medical color palette
    // Primary: Medical Cyan (#22D3EE), Clinical Blue (#38BDF8)
    // Accent: Subtle Violet (#8B5CF6)
    // Highlight: Soft White-Blue (#DCEBFF)
    const NODE_COLORS = [
      { r: 34, g: 211, b: 238 }, // #22D3EE (Cyan)
      { r: 56, g: 189, b: 248 }, // #38BDF8 (Clinical Blue)
      { r: 56, g: 189, b: 248 }, // #38BDF8 (Clinical Blue)
      { r: 139, g: 92, b: 246 }, // #8B5CF6 (Subtle Violet accent - rare)
    ];

    // Initialize Nodes
    let nodes = [];
    const initNodes = () => {
      const count = getNodeCount(width);
      nodes = [];
      for (let i = 0; i < count; i++) {
        const color = NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)];
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22, // Very slow, calm drift
          vy: (Math.random() - 0.5) * 0.22,
          radius: 1.6 + Math.random() * 1.4,
          baseAlpha: 0.35 + Math.random() * 0.35,
          color,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.015 + Math.random() * 0.02,
        });
      }
    };

    // Initialize Floating Data Particles
    let particles = [];
    const initParticles = () => {
      const count = getParticleCount(width);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.15,
          vy: -0.08 - Math.random() * 0.12, // Slow upward clinical drift
          radius: 0.9 + Math.random() * 1.2,
          alpha: 0.15 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    // Micro Signal Pulses traveling along connected nodes
    let pulses = [];
    const maxPulses = width < 768 ? 2 : 4;

    const spawnPulse = () => {
      if (pulses.length >= maxPulses || nodes.length < 2) return;
      const maxDist = getConnectionDistance(width);

      // Find two connected nodes
      const candidates = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > 30 && dist < maxDist) {
            candidates.push([i, j]);
          }
        }
      }

      if (candidates.length === 0) return;
      const [from, to] = candidates[Math.floor(Math.random() * candidates.length)];
      pulses.push({
        from,
        to,
        progress: 0,
        speed: 0.006 + Math.random() * 0.008, // Slow, elegant journey
        trail: [],
      });
    };

    initNodes();
    initParticles();

    // Render Static Frame (used for prefers-reduced-motion)
    const renderStaticFrame = () => {
      ctx.clearRect(0, 0, width, height);
      const maxDist = getConnectionDistance(width);

      // Draw faint connection lines
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.12;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw static nodes
      for (const node of nodes) {
        const { r, g, b } = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${node.baseAlpha})`;
        ctx.fill();
      }

      // Draw static particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 235, 255, ${p.alpha * 0.7})`;
        ctx.fill();
      }
    };

    // Animation Loop
    let pulseSpawnCounter = 0;

    const animate = () => {
      if (reducedMotion) {
        renderStaticFrame();
        return;
      }

      if (!isTabVisible) {
        return; // Pause completely when backgrounded
      }

      ctx.clearRect(0, 0, width, height);
      const maxDist = getConnectionDistance(width);

      // 1. Update and draw connection lines between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxDist) {
            // Understated, soft falloff
            const alpha = (1 - dist / maxDist) * 0.14;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
            ctx.lineWidth = 0.85;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // 2. Spawn and update signal pulses along connections
      pulseSpawnCounter++;
      if (pulseSpawnCounter % 90 === 0) {
        spawnPulse();
      }

      for (let pIdx = pulses.length - 1; pIdx >= 0; pIdx--) {
        const pulse = pulses[pIdx];
        const n1 = nodes[pulse.from];
        const n2 = nodes[pulse.to];

        if (!n1 || !n2) {
          pulses.splice(pIdx, 1);
          continue;
        }

        pulse.progress += pulse.speed;
        if (pulse.progress >= 1) {
          pulses.splice(pIdx, 1);
          continue;
        }

        const px = n1.x + (n2.x - n1.x) * pulse.progress;
        const py = n1.y + (n2.y - n1.y) * pulse.progress;

        // Store trail for smooth fading
        pulse.trail.push({ x: px, y: py, alpha: 0.65 });
        if (pulse.trail.length > 5) pulse.trail.shift();

        // Draw trail
        for (let t = 0; t < pulse.trail.length; t++) {
          const pt = pulse.trail[t];
          const trailAlpha = (t / pulse.trail.length) * 0.45;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 235, 255, ${trailAlpha})`;
          ctx.fill();
        }

        // Draw active pulse head with soft cyan glow
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(220, 235, 255, 0.9)";
        ctx.shadowColor = "#22D3EE";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset blur for next draws
      }

      // 3. Update & render neural nodes
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        // Boundary bounce with gentle damping
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Subtle biological breathing effect
        node.pulsePhase += node.pulseSpeed;
        const pulseFactor = Math.sin(node.pulsePhase);
        const currentAlpha = Math.max(0.15, node.baseAlpha + pulseFactor * 0.15);
        const currentRadius = node.radius + pulseFactor * 0.4;

        const { r, g, b } = node.color;

        // Soft outer halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, currentRadius * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${currentAlpha * 0.18})`;
        ctx.fill();

        // Core node
        ctx.beginPath();
        ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${currentAlpha})`;
        ctx.fill();
      }

      // 4. Update & render floating medical data particles
      for (const p of particles) {
        p.x += p.vx + Math.sin(p.phase) * 0.08;
        p.y += p.vy;
        p.phase += 0.015;

        // Screen wrap
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const pAlpha = p.alpha + Math.sin(p.phase) * 0.08;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 235, 255, ${Math.max(0.08, pAlpha)})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    if (reducedMotion) {
      renderStaticFrame();
    } else {
      animationFrameId = requestAnimationFrame(animate);
    }

    // Window Resize Handler
    let resizeTimeout = null;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resizeCanvas();
        initNodes();
        initParticles();
        pulses = [];
        if (reducedMotion) {
          renderStaticFrame();
        }
      }, 150);
    };

    // Page Visibility Handler (pause rendering when tab is inactive)
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible && !reducedMotion) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(resizeTimeout);
    };
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`medical-ambient-bg ${reducedMotion ? "reduced-motion" : ""}`}
      aria-hidden="true"
    >
      {/* Layer 1: Atmospheric Deep Space & Radial Light Fields */}
      <div className="med-bg-gradient-base" />
      <div className="med-glow-orb med-glow-cyan" />
      <div className="med-glow-orb med-glow-blue" />
      <div className="med-glow-orb med-glow-violet" />

      {/* Layer 2: Subtle Scientific Matrix Pattern (2% opacity) */}
      <div className="med-bg-grid" />

      {/* Layer 3: High-Performance Canvas (Neural Nodes, Pulses, Particles) */}
      <canvas ref={canvasRef} className="med-bg-canvas" />

      {/* Layer 4: Faint Medical ECG Waveform Horizon (Purely decorative) */}
      <div className="med-ecg-horizon">
        <svg
          className="med-ecg-svg"
          viewBox="0 0 1600 120"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="ecgStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.02" />
              <stop offset="15%" stopColor="#22D3EE" stopOpacity="0.16" />
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#22D3EE" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.02" />
            </linearGradient>
            <filter id="ecgSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Waveform with authentic P-Q-R-S-T medical rhythm intervals */}
          <path
            className="med-ecg-path"
            d="M0,60 L280,60 L292,57 L300,60 L308,60 L315,69 L323,18 L333,96 L340,54 L347,60 L358,54 L370,60 L780,60 L792,57 L800,60 L808,60 L815,69 L823,18 L833,96 L840,54 L847,60 L858,54 L870,60 L1280,60 L1292,57 L1300,60 L1308,60 L1315,69 L1323,18 L1333,96 L1340,54 L1347,60 L1358,54 L1370,60 L1600,60"
            fill="none"
            stroke="url(#ecgStrokeGrad)"
            strokeWidth="1.6"
            filter="url(#ecgSoftGlow)"
          />
        </svg>
      </div>
    </div>
  );
}
