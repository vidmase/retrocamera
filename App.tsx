import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraState, Photo } from './types';
import { RetroSwitch } from './components/RetroSwitch';
import Polaroid from './components/Polaroid';
import { generateCaption } from './services/geminiService';

const usePrintingSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio("https://www.bubbbly.com/assets/retro-camera/polaroid-camera.mp3");
  }, []);
  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(() => { });
    }
  }, []);
  return play;
};

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraBodyRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<CameraState>({
    stream: null,
    permissionGranted: false,
    isFlashOn: false,
    isCapturing: false,
  });
  const [photos, setPhotos] = useState<Photo[]>([]);

  // A pending photo sits on the camera until dragged away
  const [pendingPhoto, setPendingPhoto] = useState<Photo | null>(null);

  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [maxZIndex, setMaxZIndex] = useState(30);
  const [customText, setCustomText] = useState("May I meet you");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const playPrinting = usePrintingSound();

  // Initialize Camera
  useEffect(() => {
    let isMounted = true;
    let currentStream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 1280 }
          },
          audio: false
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        currentStream = stream;
        streamRef.current = stream;
        setState(prev => ({ ...prev, stream, permissionGranted: true }));
      } catch (error) {
        if (isMounted) {
          console.error("Camera access denied:", error);
          setState(prev => ({ ...prev, permissionGranted: false }));
        }
      }
    };

    initCamera();

    return () => {
      isMounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && state.stream) {
      videoEl.srcObject = state.stream;
      videoEl.onloadedmetadata = () => {
        videoEl.play().catch(e => console.error("Error playing video:", e));
      };
    }
  }, [state.stream]);

  const bringToFront = (id: string) => {
    const newZ = maxZIndex + 1;
    setMaxZIndex(newZ);
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, zIndex: newZ } : p));

    // If clicking the pending photo, stop ejecting mode (it's already Z-1, but this helps interaction state)
    if (pendingPhoto && pendingPhoto.id === id) {
      setPendingPhoto(p => p ? { ...p, isEjecting: false } : null);
    }
  };

  const takePhoto = async () => {
    if (pendingPhoto) return; // Block if slot occupied

    if (!videoRef.current || !canvasRef.current || state.isCapturing) return;

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    playPrinting();
    setState(prev => ({ ...prev, isCapturing: true }));

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture square
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const size = Math.min(canvas.width, canvas.height);
    const startX = (canvas.width - size) / 2;
    const startY = (canvas.height - size) / 2;

    const squareCanvas = document.createElement('canvas');
    squareCanvas.width = size;
    squareCanvas.height = size;
    const squareCtx = squareCanvas.getContext('2d');

    if (squareCtx) {
      squareCtx.drawImage(canvas, startX, startY, size, size, 0, 0, size, size);
      const dataUrl = squareCanvas.toDataURL('image/jpeg', 0.9);

      // Calculate spawn position
      let spawnX = 100;
      let spawnY = 100;

      if (cameraBodyRef.current) {
        const rect = cameraBodyRef.current.getBoundingClientRect();
        // Center alignment: Camera Left + (Camera Width / 2) - (Polaroid Width / 2)
        // Polaroid is w-64 = 16rem = 256px. 128px is half width.
        spawnX = rect.left + (rect.width / 2) - 128;

        // Spawn Y target: Falling from the bottom.
        // We set the target position (100%) to be below the camera body.
        // The CSS animation starts at -200px relative to this position (hidden behind camera).
        spawnY = rect.bottom - 60;
      }

      const newPhoto: Photo = {
        id: crypto.randomUUID(),
        dataUrl: dataUrl,
        timestamp: Date.now(),
        isDeveloping: false, // Don't animate yet
        isStaticNegative: true, // Keep as negative
        isEjecting: true,
        customText: isAiEnabled ? undefined : customText,
        x: spawnX,
        y: spawnY,
        rotation: 0, // CSS animation handles rotation during fall
        zIndex: 1
      };

      setPendingPhoto(newPhoto);

      // Flash Effect
      const flash = document.getElementById('camera-flash');
      if (flash && state.isFlashOn) {
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.opacity = '0'; }, 100);
      }

      // AI Caption
      if (isAiEnabled) {
        generateCaption(dataUrl).then(caption => {
          // Update pending photo if it's still there
          setPendingPhoto(curr => {
            if (curr && curr.id === newPhoto.id) {
              return { ...curr, caption };
            }
            return curr;
          });
          // Update saved photos if user already dragged it
          setPhotos(prev => prev.map(p => p.id === newPhoto.id ? { ...p, caption } : p));
        });
      }
    }

    setTimeout(() => {
      setState(prev => ({ ...prev, isCapturing: false }));
    }, 500);
  };

  const handlePendingDragEnd = (id: string, x: number, y: number) => {
    if (!pendingPhoto || pendingPhoto.id !== id) return;

    // Move from Pending (Behind) to Photos (Front)
    // Setting isDeveloping to false here triggers the sharpen effect
    const finalPhoto = {
      ...pendingPhoto,
      x: x,
      y: y,
      isEjecting: false,
      isDeveloping: true, // Start developing animation
      isStaticNegative: false, // Remove static negative
      rotation: (Math.random() * 10 - 5),
      zIndex: maxZIndex + 1
    };

    setMaxZIndex(prev => prev + 1);
    setPhotos(prev => [...prev, finalPhoto]);
    setPendingPhoto(null);
  };

  return (
    <div className="relative h-screen w-full bg-stone-900 overflow-hidden font-sans selection:bg-accent selection:text-white touch-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* LAYER 1: Backgrounds (Bottom) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/bg.png')" }}
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* LAYER 2: Pending Photo (Behind Camera) 
          - z-index 10
          - Contains only the ejecting/pending photo
      */}
      <div className="absolute inset-0 z-10 w-full h-full pointer-events-none overflow-hidden">
        {pendingPhoto && <div
          className={`absolute ${pendingPhoto.isEjecting ? 'overflow-hidden' : ''} pointer-events-auto`}
          style={{
            // Wrapper positioned at the slot. 
            // We add padding to the wrapper to avoid clipping the shadow.
            // pendingPhoto.x/y are the desired top-left of the PHOTO.
            // So wrapper starts at x-20, y.
            left: pendingPhoto.x - 20,
            top: pendingPhoto.y,
            width: '300px', // 256px (photo) + 40px (padding) + extra
            height: '450px', // Enough for photo + shadow
            zIndex: 10
          }}
        >
          <Polaroid
            // Pass local coordinates (20px padding offset)
            photo={{ ...pendingPhoto, x: 20, y: 0 }}
            onFocus={() => bringToFront(pendingPhoto.id)}
            onDragEnd={(id, x, y) => {
              // Convert local wrapper coords back to global
              // Global X = Wrapper Left (pendingPhoto.x - 20) + Local X (x)
              // Global Y = Wrapper Top (pendingPhoto.y) + Local Y (y)
              handlePendingDragEnd(id, (pendingPhoto.x - 20) + x, pendingPhoto.y + y);
            }}
            className={pendingPhoto.isEjecting ? "animate-eject" : ""}
          />
        </div>
        }
      </div>

      {/* LAYER 3: Foreground UI & Camera (Middle) 
          - z-index 20
          - Covers the pending photo layer
      */}
      <div className="absolute inset-0 flex flex-col lg:flex-row w-full h-full pointer-events-none z-20">

        {/* Left/Top Column: Camera Zone 
              - Moves camera up (justify-start + pt-12) on mobile to allow space for falling photo
              - Moves camera up (pb-32) on desktop
          */}
        <div className="w-full lg:w-[40%] h-[55%] lg:h-full relative flex flex-col justify-start pt-12 lg:justify-center lg:pt-0 lg:pb-32 items-center">
          {/* Header */}
          <div className="absolute top-0 left-0 w-full p-4 lg:p-6 z-40 flex justify-between items-start">
            <div className="flex items-center gap-3 text-white/80 pointer-events-auto w-fit bg-black/20 backdrop-blur-sm p-2 rounded-lg lg:bg-transparent lg:backdrop-blur-none lg:p-0">
              <i className="fas fa-camera-retro text-2xl lg:text-3xl text-accent" />
              <h1 className="text-xl lg:text-3xl font-mono tracking-tighter text-white">RETRO<span className="text-accent">CAM</span>.AI</h1>
            </div>
          </div>

          {/* Camera Body Container */}
          <div ref={cameraBodyRef} className="relative w-[85vw] max-w-[360px] select-none pointer-events-auto mt-2 lg:mt-0">
            <img
              src="https://www.bubbbly.com/assets/retro-camera.webp"
              alt="Retro Camera"
              className="w-full h-auto drop-shadow-2xl relative pointer-events-none"
            />
            {/* Lens - LOCKED */}
            <div
              className="absolute w-[30%] aspect-square rounded-full bg-black overflow-hidden shadow-[inset_0_10px_25px_rgba(0,0,0,0.8)] ring-4 ring-[#111]"
              style={{
                top: '40%',
                left: '47%'
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-[1.35] pointer-events-none"
              />
              <div className="absolute inset-0 rounded-full shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none" />
              <div id="camera-flash" className="absolute inset-0 bg-white opacity-0 pointer-events-none transition-opacity duration-100 z-50" />
            </div>

            {/* Shutter Button - Mapped to left 18% as requested */}
            <button
              onClick={takePhoto}
              disabled={!state.permissionGranted || state.isCapturing || !!pendingPhoto}
              className={`absolute w-[15%] aspect-square rounded-full focus:outline-none group transition-all z-50 ${!!pendingPhoto ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
              style={{
                top: '48%',
                left: '18%'
              }}
              aria-label="Take Photo"
            >
              <div className={`w-full h-full rounded-full transition-colors duration-200 ${!!pendingPhoto ? '' : 'hover:bg-white/10 active:bg-white/20'}`} />
            </button>
          </div>
        </div>

        {/* Settings UI - Moved to Top Right */}
        <div className="absolute top-4 right-4 lg:top-6 lg:right-6 z-50 flex flex-col items-end pointer-events-auto">

          {/* Mobile Toggle Button */}
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="lg:hidden mb-2 bg-black/40 backdrop-blur-md border border-white/10 text-white/80 px-3 py-1 rounded-full text-sm font-mono flex items-center gap-2"
          >
            <i className={`fas ${isSettingsOpen ? 'fa-times' : 'fa-sliders-h'}`} />
            {isSettingsOpen ? 'Close' : 'Settings'}
          </button>

          <div className={`${isSettingsOpen ? 'flex' : 'hidden'} lg:flex bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/10 flex-col lg:flex-row items-end lg:items-center gap-2 lg:gap-4 shadow-xl`}>
            <div className="flex gap-2 lg:gap-4">
              <RetroSwitch isOn={state.isFlashOn} onToggle={() => setState(prev => ({ ...prev, isFlashOn: !prev.isFlashOn }))} label="Flash" />
              <RetroSwitch isOn={isAiEnabled} onToggle={() => setIsAiEnabled(!isAiEnabled)} label="AI" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border-l border-white/10 pl-2 ml-1 lg:pl-3">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  disabled={isAiEnabled}
                  placeholder={isAiEnabled ? "AI Enabled" : "Enter text..."}
                  className={`bg-transparent border-b border-white/30 text-white font-mono text-xs lg:text-sm px-1 py-1 outline-none focus:border-accent w-24 lg:w-32 placeholder:text-white/30 transition-opacity ${isAiEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  maxLength={20}
                />
              </div>
              <button
                onClick={() => setPhotos([])}
                className="ml-1 px-2 py-1 text-white/80 hover:text-accent transition-colors font-fredericka text-base lg:text-lg tracking-widest"
                title="Reset Photos"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Right/Bottom Column: Gallery Space */}
        <div className="w-full lg:w-[60%] h-[45%] lg:h-full relative">
          {/* Controls moved to top right */}

          <div className="absolute bottom-4 w-full text-center lg:bottom-6 lg:right-6 lg:w-auto lg:text-right text-white/20 font-mono text-xs lg:text-sm pointer-events-none select-none">
            DRAG PHOTOS TO KEEP
          </div>
        </div>
      </div>

      {/* LAYER 4: Saved Photos (Top) 
          - z-index 30
          - Always above the camera
      */}
      <div className="absolute inset-0 z-30 w-full h-full pointer-events-none overflow-hidden">
        {photos.map(photo => (
          <div key={photo.id} className="pointer-events-auto">
            <Polaroid photo={photo} onFocus={bringToFront} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;