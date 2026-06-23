// Premium board base: a raised beveled platform, glowing accent rims (picked up
// by Bloom), and a center pedestal where the dice sit. Shared by both rings.
// NOTE: horizontal surfaces are spaced apart in Y (>= ~0.08) to avoid z-fighting
// flicker between near-coplanar overlapping faces.

export interface BoardBaseProps {
  radius: number;
  quality: 'high' | 'low';
}

export default function BoardBase({ radius, quality }: BoardBaseProps) {
  const high = quality === 'high';
  return (
    <group>
      {/* raised platform (the "table") — top sits at y = -0.20 */}
      <mesh position={[0, -0.55, 0]} receiveShadow={high} castShadow={high}>
        <cylinderGeometry args={[radius + 1.9, radius + 2.2, 0.7, 96]} />
        <meshStandardMaterial color="#0d1430" roughness={0.55} metalness={0.6} />
      </mesh>

      {/* polished top surface (y = -0.12, well below the tiles at y >= -0.03) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow={high}>
        <circleGeometry args={[radius + 1.6, 96]} />
        <meshStandardMaterial color="#141d3c" roughness={0.32} metalness={0.7} />
      </mesh>

      {/* outer glowing rim (y = -0.04, above the disc) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <torusGeometry args={[radius + 1.55, 0.13, 20, 160]} />
        <meshStandardMaterial color="#3aa0ff" emissive="#3aa0ff" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>

      {/* inner gold accent ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <torusGeometry args={[radius - 1.4, 0.1, 20, 160]} />
        <meshStandardMaterial color="#f1c40f" emissive="#f1c40f" emissiveIntensity={1.0} toneMapped={false} />
      </mesh>

      {/* center pedestal — a tall cylinder reaching down INTO the platform so no
          horizontal face is coplanar with another (avoids z-fighting). Top at y=0.175. */}
      <mesh position={[0, -0.25, 0]} receiveShadow={high} castShadow={high}>
        <cylinderGeometry args={[1.7, 1.95, 0.85, 64]} />
        <meshStandardMaterial color="#101a37" roughness={0.4} metalness={0.65} />
      </mesh>
      {/* glow ring above the pedestal top */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.24, 0]}>
        <ringGeometry args={[1.5, 1.68, 64]} />
        <meshStandardMaterial color="#3aa0ff" emissive="#3aa0ff" emissiveIntensity={1.1} toneMapped={false} />
      </mesh>
    </group>
  );
}
