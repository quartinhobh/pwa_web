import { useState, useCallback } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  velocity: number;
  size: number;
  rotation: number;
}

const COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'];
const PARTICLE_COUNT = 30;

function createParticles(x: number, y: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x,
    y,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    angle: Math.random() * 360,
    velocity: 2 + Math.random() * 4,
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfettiBurst() {
  const [particles, setParticles] = useState<Particle[]>([]);

  const burst = useCallback((centerX: number, centerY: number) => {
    const newParticles = createParticles(centerX, centerY);
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1000);
  }, []);

  return { particles, burst };
}

export function ConfettiLayer({ particles }: { particles: Particle[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[61]" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            '--confetti-color': p.color,
            '--confetti-angle': `${p.angle}deg`,
            '--confetti-velocity': p.velocity,
            '--confetti-size': `${p.size}px`,
            '--confetti-rotation': `${p.rotation}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}