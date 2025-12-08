import React, { useEffect, useState } from 'react';
import { Photo } from '../types';

interface LiquidFlowEffectProps {
  photo: Photo | null;
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  onComplete: () => void;
}

export const LiquidFlowEffect: React.FC<LiquidFlowEffectProps> = ({
  photo,
  startPosition,
  endPosition,
  onComplete
}) => {
  const [phase, setPhase] = useState<'melting' | 'flowing' | 'done'>('melting');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number; size: number }>>([]);

  useEffect(() => {
    if (!photo) return;

    // Reset phase for new animation
    setPhase('melting');

    // Generate liquid particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 60 - 30,
      y: Math.random() * 60 - 30,
      delay: Math.random() * 0.45, // 50% slower
      size: 8 + Math.random() * 16
    }));
    setParticles(newParticles);

    // Phase transitions - 50% slower
    const meltTimer = setTimeout(() => setPhase('flowing'), 600);
    const flowTimer = setTimeout(() => setPhase('done'), 1350);
    const completeTimer = setTimeout(onComplete, 1400);

    return () => {
      clearTimeout(meltTimer);
      clearTimeout(flowTimer);
      clearTimeout(completeTimer);
    };
  }, [photo, onComplete]);

  if (!photo || phase === 'done') return null;

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
      {/* SVG Filters for liquid effect */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="liquid-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
          <filter id="liquid-distort">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015"
              numOctaves="2"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.015;0.035;0.015"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Main liquid container */}
      <div
        className="absolute transition-all ease-out"
        style={{
          left: phase === 'melting' ? startPosition.x : endPosition.x,
          top: phase === 'melting' ? startPosition.y : endPosition.y,
          transform: 'translate(-50%, -50%)',
          transitionDuration: phase === 'flowing' ? '750ms' : '0ms',
          filter: phase === 'melting' ? 'url(#liquid-distort)' : 'none'
        }}
      >
        {/* Melting photo */}
        {phase === 'melting' && (
          <div className="relative animate-liquid-melt">
            {/* Photo container with melt effect */}
            <div 
              className="relative w-32 h-40 bg-white p-1 shadow-2xl"
              style={{
                filter: 'url(#liquid-goo)',
                animation: 'liquidMelt 600ms ease-in forwards'
              }}
            >
              {photo.mediaType === 'video' ? (
                <video
                  src={photo.dataUrl}
                  className="w-full h-28 object-cover"
                  muted
                />
              ) : (
                <img
                  src={photo.dataUrl}
                  alt=""
                  className="w-full h-28 object-cover"
                />
              )}
            </div>

            {/* Dripping effect */}
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-8 bg-white rounded-full opacity-90"
                  style={{
                    animation: `drip 600ms ease-in ${i * 75}ms forwards`,
                    transformOrigin: 'top center'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Flowing particles */}
        {phase === 'flowing' && (
          <div className="relative" style={{ filter: 'url(#liquid-goo)' }}>
            {particles.map((particle) => (
              <div
                key={particle.id}
                className="absolute bg-white rounded-full shadow-lg"
                style={{
                  width: particle.size,
                  height: particle.size,
                  left: particle.x,
                  top: particle.y,
                  animation: `liquidParticle 750ms ease-in-out ${particle.delay}s forwards`,
                  opacity: 0.9
                }}
              />
            ))}
            {/* Central blob */}
            <div 
              className="w-16 h-16 bg-white rounded-full shadow-2xl"
              style={{
                animation: 'liquidPulse 750ms ease-in-out forwards'
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes liquidMelt {
          0% {
            transform: scaleY(1) scaleX(1);
            border-radius: 0;
          }
          30% {
            transform: scaleY(1.1) scaleX(0.9);
          }
          60% {
            transform: scaleY(0.7) scaleX(1.2);
            border-radius: 30% 30% 50% 50%;
          }
          100% {
            transform: scaleY(0.3) scaleX(1.5);
            border-radius: 50%;
            opacity: 0;
          }
        }

        @keyframes drip {
          0% {
            transform: scaleY(0) translateY(0);
            opacity: 1;
          }
          50% {
            transform: scaleY(2) translateY(20px);
            opacity: 0.8;
          }
          100% {
            transform: scaleY(4) translateY(50px);
            opacity: 0;
          }
        }

        @keyframes liquidParticle {
          0% {
            transform: scale(1) translate(0, 0);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.3) translate(var(--particle-x, 10px), var(--particle-y, -20px));
            opacity: 0.7;
          }
          100% {
            transform: scale(0.5) translate(0, 0);
            opacity: 0;
          }
        }

        @keyframes liquidPulse {
          0% {
            transform: scale(2);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
