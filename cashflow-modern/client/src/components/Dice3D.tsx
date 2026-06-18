import { useEffect, useRef, useState } from 'react';

// pip positions in a 3x3 grid (1..9) for each face value
const PIP: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9]
};

// resting cube rotation (deg) that brings each value's face to the front.
// Faces: front=1, back=6, right=3, left=4, top=2, bottom=5 (opposites sum to 7).
const REST: Record<number, [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180]
};

const Face = ({ value, cls }: { value: number; cls: string }) => (
  <div className={`d-face ${cls}`}>
    {Array.from({ length: 9 }, (_, i) => (
      <span key={i} className={'pip' + (PIP[value].includes(i + 1) ? ' on' : '')} />
    ))}
  </div>
);

export default function Dice3D({ value, trigger }: { value: number | null; trigger: string }) {
  const rot = useRef({ x: -25, y: -25 });
  const [transform, setTransform] = useState('rotateX(-25deg) rotateY(-25deg)');
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!value) return;
    const [rx, ry] = REST[value];
    const turns = 4;
    const nx = Math.ceil(rot.current.x / 360) * 360 + 360 * turns + rx;
    const ny = Math.ceil(rot.current.y / 360) * 360 + 360 * turns + ry;
    rot.current = { x: nx, y: ny };
    setRolling(true);
    setTransform(`rotateX(${nx}deg) rotateY(${ny}deg)`);
    const id = setTimeout(() => setRolling(false), 1050);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <div className="dice3d">
      <div className={`cube${rolling ? ' rolling' : ''}`} style={{ transform }}>
        <Face value={1} cls="f-front" />
        <Face value={6} cls="f-back" />
        <Face value={3} cls="f-right" />
        <Face value={4} cls="f-left" />
        <Face value={2} cls="f-top" />
        <Face value={5} cls="f-bottom" />
      </div>
    </div>
  );
}
