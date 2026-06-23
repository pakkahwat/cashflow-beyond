import { useEffect, useRef } from 'react';

const COLORS = ['#f1c40f', '#3aa0ff', '#2ecc71', '#e74c3c', '#9b59b6', '#ff7a59'];

export default function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const N = 160;
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * -h,
      r: 4 + Math.random() * 6,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      vy: 2 + Math.random() * 4,
      vx: -1.5 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4
    }));

    let raf = 0;
    let running = true;
    const stopAt = Date.now() + 6000;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      parts.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vr;
        if (p.y > h + 20) {
          p.y = -20;
          p.x = Math.random() * w;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        ctx.restore();
      });
      if (running && Date.now() < stopAt) raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} className="confetti-canvas" />;
}
