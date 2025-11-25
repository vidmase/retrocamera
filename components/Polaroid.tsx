import React, { useState, useEffect, useRef } from 'react';
import { Photo } from '../types';

interface PolaroidProps {
  photo: Photo;
  onFocus: (id: string) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  className?: string;
}

const Polaroid: React.FC<PolaroidProps> = ({ photo, onFocus, onDragEnd, className = '' }) => {
  const dateStr = new Date(photo.timestamp).toLocaleString(undefined, {
    year: '2-digit',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // We initialize state from props, but we don't sync it back to props automatically 
  // unless the key changes (remounting) or we explicitly want to reset.
  const [position, setPosition] = useState({ x: photo.x, y: photo.y });
  const [isDragging, setIsDragging] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [note, setNote] = useState(photo.backNote || "");

  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStartTime = useRef(0);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  const hasMoved = useRef(false);

  // We need to keep references to the listeners to remove them properly
  const listenersRef = useRef<{
    move: (e: MouseEvent | TouchEvent) => void;
    end: (e: MouseEvent | TouchEvent) => void;
  } | null>(null);

  const handleStart = (clientX: number, clientY: number, target: EventTarget | null) => {
    if (target && (target as HTMLElement).tagName === 'TEXTAREA') return;
    if (photo.isEjecting) return;

    onFocus(photo.id);
    setIsDragging(true);
    hasMoved.current = false;
    dragStartPos.current = { x: clientX, y: clientY };

    if (elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: clientX - position.x,
        y: clientY - position.y
      };
    }

    // Define listeners
    const handleWindowMove = (e: MouseEvent | TouchEvent) => {
      const cx = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const cy = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const newX = cx - dragOffset.current.x;
      const newY = cy - dragOffset.current.y;

      setPosition({ x: newX, y: newY });

      // Check if moved enough to consider it a drag
      const dist = Math.sqrt(Math.pow(cx - dragStartPos.current.x, 2) + Math.pow(cy - dragStartPos.current.y, 2));
      if (dist > 5) {
        hasMoved.current = true;
      }
    };

    const handleWindowUp = (e: MouseEvent | TouchEvent) => {
      setIsDragging(false);

      // Clean up listeners
      if (listenersRef.current) {
        window.removeEventListener('mousemove', listenersRef.current.move);
        window.removeEventListener('mouseup', listenersRef.current.end);
        window.removeEventListener('touchmove', listenersRef.current.move);
        window.removeEventListener('touchend', listenersRef.current.end);
        listenersRef.current = null;
      }

      // Handle Drag End
      // We need the final position. Since we update state on move, 'position' state might be slightly stale 
      // in this closure if we relied on it, but we are just triggering the callback.
      // Actually, we should pass the LATEST position. 
      // Ideally we'd calculate it one last time or trust the state. 
      // For simplicity, let's trust the last render cycle's position or the one we just set.
      // But wait, 'position' in this closure is stale (from render time).
      // However, we don't need the exact pixel perfect position for the onDragEnd callback *inside* the component usually,
      // unless the parent relies on it. 
      // Let's use the calculated position from the event if possible, or just the state.
      // Since 'position' is state, accessing it here gives the value at render time. 
      // To get fresh value we'd need a ref for position too.
      // Let's add a positionRef to track it synchronously.

      if (onDragEnd) {
        // We'll use the current position from the ref (added below)
        onDragEnd(photo.id, positionRef.current.x, positionRef.current.y);
      }

      // Handle Click/Tap (Flip)
      if (!hasMoved.current && !photo.isEjecting && !photo.isDeveloping) {
        setIsFlipped(prev => !prev);
      }
    };

    listenersRef.current = { move: handleWindowMove, end: handleWindowUp };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
    window.addEventListener('touchmove', handleWindowMove, { passive: false });
    window.addEventListener('touchend', handleWindowUp);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY, e.target);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
  };

  // Keep a ref of position for the event handlers to access fresh values
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  return (
    <div
      ref={elementRef}
      className={`absolute w-44 sm:w-52 h-[18rem] sm:h-[21rem] select-none transition-shadow duration-300 ${className} ${isDragging ? 'z-[1000] scale-105' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        zIndex: isDragging ? 9999 : photo.zIndex,
        // If ejecting, disable transform so CSS animation takes precedence
        transform: photo.isEjecting ? undefined : `rotate(${photo.rotation}deg)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'box-shadow 0.3s, transform 0.3s',
        perspective: '1000px'
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div
        className="relative w-full h-full transition-transform duration-700 transform-style-3d"
        style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* FRONT SIDE */}
        <div className="absolute inset-0 backface-hidden">
          <div className="relative bg-white p-3 pb-8 shadow-xl polaroid-shadow h-full flex flex-col">
            {/* Tape effect - hide if ejecting */}
            {!photo.isEjecting && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-white/30 backdrop-blur-sm border-l border-r border-white/50 transform -rotate-1 pointer-events-none" />
            )}

            {/* Image Area */}
            <div className="aspect-square bg-black overflow-hidden relative mb-3 border border-gray-100 pointer-events-none shrink-0">
              <img
                src={photo.dataUrl}
                alt="Memory"
                className={`w-full h-full object-cover ${photo.isDeveloping ? 'animate-develop-negative' :
                  photo.isStaticNegative ? 'invert grayscale contrast-[1.2]' : ''
                  }`}
              />
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dust.png')] opacity-30 mix-blend-overlay" />
            </div>

            {/* Caption Area */}
            <div className="text-center flex-1 flex flex-col justify-center items-center pointer-events-none">
              <p className="font-hand text-2xl text-gray-800 leading-none">
                {photo.caption || ""}
              </p>
              <p className="font-mono text-[10px] text-gray-400 mt-1 uppercase tracking-widest">{photo.customText || dateStr}</p>
            </div>
          </div>
        </div>

        {/* BACK SIDE */}
        <div
          className="absolute inset-0 backface-hidden bg-[#f8f8f8] p-4 shadow-xl polaroid-shadow flex flex-col items-center justify-center transform rotate-y-180"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center gap-4 bg-[url('https://www.transparenttextures.com/patterns/cardboard.png')]">
            <div className="text-gray-400 font-mono text-xs tracking-widest uppercase border-b border-gray-300 pb-1 w-full text-center">
              Notes
            </div>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                photo.backNote = e.target.value; // Direct mutation for simplicity in this context, ideally propagate up
              }}
              placeholder="Write a memory..."
              className="w-full h-full bg-transparent resize-none outline-none font-hand text-xl text-gray-700 leading-relaxed text-center placeholder:text-gray-300"
              onMouseDown={(e) => e.stopPropagation()} // Allow text interaction without dragging
              onTouchStart={(e) => e.stopPropagation()}
            />
            <div className="text-[10px] text-gray-300 font-mono">
              {dateStr}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Polaroid;