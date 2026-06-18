import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export interface EffectsProps {
  enabled: boolean;
}

/** Stable post-FX: Bloom (glow on emissive rims/active tile) + Vignette + AgX tone
 *  mapping, with MSAA. (N8AO/SMAA were removed — they caused flicker on this scene.) */
export default function Effects({ enabled }: EffectsProps) {
  if (!enabled) return null;
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.7} luminanceThreshold={0.7} luminanceSmoothing={0.4} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={0.7} />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
