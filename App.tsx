import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraState, Photo } from './types';
import { RetroSwitch } from './components/RetroSwitch';
import Polaroid from './components/Polaroid';
import { generateCaption } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { AuthModal } from './components/AuthModal';

const useReloadSound = () => {

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    // Mechanical camera wind/reload sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2579/2579-preview.mp3");
  }, []);
  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.6;
      audioRef.current.play().catch(() => { });
    }
  }, []);
  return play;
};

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

const useShutterSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio("/shoot_sound.mp3");
  }, []);
  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.6;
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

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Check Supabase Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [state, setState] = useState<CameraState>({
    stream: null,
    permissionGranted: false,
    isFlashOn: false,
    isCapturing: false,
    isPoweredOn: false,
  });
  const [photos, setPhotos] = useState<Photo[]>([]);

  // Film Roll Logic
  const [shotsLeft, setShotsLeft] = useState(8);
  const [isReloading, setIsReloading] = useState(false);

  // A pending photo sits on the camera until dragged away
  const [pendingPhoto, setPendingPhoto] = useState<Photo | null>(null);

  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [maxZIndex, setMaxZIndex] = useState(30);
  const [customText, setCustomText] = useState("May I meet you");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showPageFlash, setShowPageFlash] = useState(false);
  const [flashBurstPos, setFlashBurstPos] = useState<{ x: number, y: number } | null>(null);

  // Collaboration State
  const [room, setRoom] = useState("global");

  const playPrinting = usePrintingSound();
  const playReload = useReloadSound();
  const playShutter = useShutterSound();

  // Load & Subscribe to Photos
  useEffect(() => {
    if (!user) {
      setPhotos([]);
      return;
    }

    // 1. Fetch initial photos
    const fetchPhotos = async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('room_id', room)
        .order('created_at', { ascending: true })
        .limit(50); // Limit to last 50 to prevent crash

      if (data) {
        // Map DB fields to Photo type
        const mapped: Photo[] = data.map((p: any) => ({
          id: p.id,
          dataUrl: p.data_url,
          timestamp: new Date(p.created_at).getTime(),
          isDeveloping: false,
          isStaticNegative: false,
          isEjecting: false,
          caption: p.caption,
          x: p.x,
          y: p.y,
          rotation: p.rotation,
          zIndex: p.z_index,
          customText: p.caption ? undefined : "Shared Memory" // Fallback
        }));
        setPhotos(mapped);
        if (mapped.length > 0) {
          setMaxZIndex(Math.max(...mapped.map(p => p.zIndex)) + 1);
        }
      }
    };

    fetchPhotos();

    // 2. Subscribe to changes
    const channel = supabase
      .channel(`room:${room}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos', filter: `room_id=eq.${room}` }, (payload) => {
        const p = payload.new as any;
        const newPhoto: Photo = {
          id: p.id,
          dataUrl: p.data_url,
          timestamp: new Date(p.created_at).getTime(),
          isDeveloping: true, // Animate in
          isStaticNegative: false,
          isEjecting: false,
          caption: p.caption,
          x: p.x,
          y: p.y,
          rotation: p.rotation,
          zIndex: p.z_index,
          customText: p.caption ? undefined : "Shared Memory"
        };

        // Only add if not already present (prevent double add from local optimistic update if we did that, but here we rely on sub)
        setPhotos(prev => {
          if (prev.find(existing => existing.id === newPhoto.id)) return prev;
          return [...prev, newPhoto];
        });

        // Stop developing animation after 5s
        setTimeout(() => {
          setPhotos(prev => prev.map(ph => ph.id === newPhoto.id ? { ...ph, isDeveloping: false } : ph));
        }, 5200);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, user]);

  // Initialize Camera
  useEffect(() => {
    let isMounted = true;
    let currentStream: MediaStream | null = null;

    const initCamera = async () => {
      if (!state.isPoweredOn) {
        if (state.stream) {
          setState(prev => ({ ...prev, stream: null }));
        }
        return;
      }

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
  }, [state.isPoweredOn]);

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
    if (shotsLeft <= 0 || isReloading || !state.isPoweredOn) return; // Block if empty, reloading, or off

    if (!videoRef.current || !canvasRef.current || state.isCapturing) return;

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    playShutter();
    setState(prev => ({ ...prev, isCapturing: true }));
    setShotsLeft(prev => prev - 1); // Decrement shots

    // Calculate flash burst position
    if (state.isFlashOn) {
      if (cameraBodyRef.current) {
        const rect = cameraBodyRef.current.getBoundingClientRect();
        // Flash unit center: Left 12% + half of 22% width, Top 12% + half of 22% height
        const flashX = rect.left + (rect.width * 0.23);
        const flashY = rect.top + (rect.height * 0.23);
        setFlashBurstPos({ x: flashX, y: flashY });
      }

      setShowPageFlash(true);
      setTimeout(() => setShowPageFlash(false), 400);
    }

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

      // Flash Effect (Immediate)
      const flash = document.getElementById('camera-flash');
      if (flash && state.isFlashOn) {
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.opacity = '0'; }, 100);
      }

      // Delay Photo Ejection by 1 second
      setTimeout(() => {
        playPrinting();

        // Calculate spawn position
        let spawnX = 100;
        let spawnY = 100;

        if (cameraBodyRef.current) {
          const rect = cameraBodyRef.current.getBoundingClientRect();
          // Center alignment: Camera Left + (Camera Width / 2) - (Polaroid Width / 2)
          // Mobile (w-56 = 224px) -> half is 112px
          // Desktop (w-64 = 256px) -> half is 128px
          const halfWidth = window.innerWidth < 640 ? 112 : 128;
          spawnX = rect.left + (rect.width / 2) - halfWidth;

          // Spawn Y target: Falling from the bottom.
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
            // setPhotos(prev => prev.map(p => p.id === newPhoto.id ? { ...p, caption } : p));
          });
        }

        // Reset capturing state after ejection starts
        setTimeout(() => {
          setState(prev => ({ ...prev, isCapturing: false }));
        }, 500);

        // End ejection animation after 3s to show the drag hint
        setTimeout(() => {
          setPendingPhoto(curr => curr ? { ...curr, isEjecting: false } : null);
        }, 3000);

      }, 4000);
    }
  };

  const handlePendingDragEnd = async (id: string, x: number, y: number) => {
    if (!pendingPhoto || pendingPhoto.id !== id) return;

    // If user is not logged in, just keep local behavior or prompt?
    // For now, let's allow local but warn or just do local if no user.
    // Actually, let's require login for "keeping" if we want to enforce collaboration.
    // But better UX: If not logged in, just show locally. If logged in, save to DB.

    const rotation = (Math.random() * 10 - 5);
    const zIndex = maxZIndex + 1;

    if (user) {
      // Save to Supabase
      const { error } = await supabase.from('photos').insert({
        room_id: room,
        data_url: pendingPhoto.dataUrl,
        caption: pendingPhoto.caption,
        x: x,
        y: y,
        rotation: rotation,
        z_index: zIndex
      });

      if (error) {
        console.error("Error saving photo:", error);
        alert("Failed to save photo to the cloud!");
      }
    } else {
      // Local fallback
      const finalPhoto = {
        ...pendingPhoto,
        x: x,
        y: y,
        isEjecting: false,
        isDeveloping: true,
        isStaticNegative: false,
        rotation: rotation,
        zIndex: zIndex
      };
      setPhotos(prev => [...prev, finalPhoto]);
      setTimeout(() => {
        setPhotos(prev => prev.map(p => p.id === id ? { ...p, isDeveloping: false } : p));
      }, 5200);
    }

    setMaxZIndex(prev => prev + 1);
    setPendingPhoto(null);
  };

  const handleReload = () => {
    if (isReloading) return;
    setIsReloading(true);
    playReload();

    setTimeout(() => {
      setShotsLeft(8);
      setIsReloading(false);
    }, 2000); // Simulate reload time
  };

  return (
    <div className="relative h-screen w-full bg-stone-900 overflow-hidden font-sans selection:bg-accent selection:text-white touch-none">
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={() => setIsAuthOpen(false)}
      />
      {/* Flash Burst Effect - Emanates from camera flash */}
      {showPageFlash && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            top: flashBurstPos ? flashBurstPos.y : '50%',
            left: flashBurstPos ? flashBurstPos.x : '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* 1. Global Room Flash (The big expanding circle) */}
          <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-white rounded-full animate-flash-burst shadow-[0_0_100px_50px_rgba(255,255,255,0.8)]" />

          {/* 2. Concentrated Source Flare */}
          {/* Core Glow */}
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/80 rounded-full blur-2xl animate-flash-core" />

          {/* Sharp Center */}
          <div className="absolute top-1/2 left-1/2 w-8 h-8 bg-white rounded-full shadow-[0_0_50px_20px_white] animate-flash-core" />

          {/* Starburst Rays - Wrapped in rotated containers to preserve animation transform */}
          {/* Horizontal */}
          <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center">
            <div className="w-[150vmax] h-[2px] bg-gradient-to-r from-transparent via-white to-transparent animate-flash-ray" />
          </div>
          {/* Vertical */}
          <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center rotate-90">
            <div className="w-[150vmax] h-[2px] bg-gradient-to-r from-transparent via-white to-transparent animate-flash-ray" />
          </div>
          {/* Diagonal 1 */}
          <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center rotate-45">
            <div className="w-[100vmax] h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent animate-flash-ray" />
          </div>
          {/* Diagonal 2 */}
          <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center -rotate-45">
            <div className="w-[100vmax] h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent animate-flash-ray" />
          </div>
        </div>
      )}

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
            width: window.innerWidth < 640 ? '260px' : '300px', // Responsive wrapper width
            height: window.innerWidth < 640 ? '380px' : '450px', // Responsive wrapper height
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

          {/* Drag Hint - Appears after ejection */}
          {!pendingPhoto.isEjecting && (
            <div className="absolute z-50 pointer-events-none whitespace-nowrap top-full left-1/2 -translate-x-1/2 mt-4 lg:top-1/2 lg:left-full lg:ml-4 lg:-translate-y-1/2 lg:translate-x-0 lg:mt-0">
              <div className="flex items-center gap-3 animate-bounce flex-col lg:flex-row">
                {/* Arrow: Mobile=Down(90deg), Desktop=Right(0deg) */}
                <i className="fas fa-long-arrow-alt-right text-white text-3xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] transform rotate-90 lg:rotate-0" />
                <div className="flex flex-col items-center lg:items-start">
                  <span className="font-fredericka text-white text-xl tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    <span className="lg:hidden">DRAG DOWN TO</span>
                    <span className="hidden lg:inline">DRAG TO</span>
                  </span>
                  <span className="font-fredericka text-accent text-xl tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    DEVELOP
                  </span>
                </div>
              </div>
            </div>
          )}
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
            {/* Flash Unit - Interactive */}
            <div
              className={`absolute z-40 cursor-pointer group ${!state.isPoweredOn ? 'pointer-events-none opacity-50' : ''}`}
              style={{ top: '13.5%', left: '14.5%', width: '19%', height: '19%' }}
              onClick={() => state.isPoweredOn && setState(prev => ({ ...prev, isFlashOn: !prev.isFlashOn }))}
              title="Toggle Flash"
            >
              {/* Glass Container with Fresnel Lens Effect */}
              <div className={`relative w-full h-full rounded-xl overflow-hidden transition-all duration-500 ${state.isFlashOn
                ? 'shadow-[inset_0_0_15px_rgba(255,255,255,0.4)]'
                : 'opacity-0 hover:opacity-100' // Show glass hint on hover
                }`}>

                {/* Fresnel Lens Texture (Grid pattern) */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(255,255,255,0.1)_3px,transparent_4px)] opacity-30" />
                <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.1)_3px,transparent_4px)] opacity-20" />

                {/* "Charged" Gas Glow (Only when ON) - Subtle blueish tint of xenon */}
                <div className={`absolute inset-0 bg-blue-100/10 transition-opacity duration-700 ${state.isFlashOn ? 'opacity-100' : 'opacity-0'}`} />

                {/* Xenon Bulb (The horizontal tube) */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[15%] rounded-full transition-all duration-500 ${state.isFlashOn
                  ? 'bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.6)] blur-[1px]'
                  : 'bg-white/10'
                  }`} />

                {/* Glass Shine/Reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-30" />

                {/* The actual flash burst whiteout overlay */}
                <div id="camera-flash" className="absolute inset-0 bg-white opacity-0 pointer-events-none transition-opacity duration-100 mix-blend-hard-light" />
              </div>
            </div>

            {/* Lens - Interactive Power Switch */}
            <div
              className="absolute w-[30%] aspect-square rounded-full bg-black overflow-hidden shadow-[inset_0_10px_25px_rgba(0,0,0,0.8)] ring-4 ring-[#111] cursor-pointer group"
              style={{
                top: '40%',
                left: '47%'
              }}
              onClick={() => setState(prev => ({ ...prev, isPoweredOn: !prev.isPoweredOn }))}
              title={state.isPoweredOn ? "Turn Off" : "Turn On"}
            >
              {/* Video Stream */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform scale-[1.35] pointer-events-none transition-opacity duration-700 ${state.isPoweredOn ? 'opacity-100' : 'opacity-0'}`}
              />

              {/* Mechanical Shutter Overlay */}
              <div
                className={`absolute inset-0 z-20 pointer-events-none transition-all duration-700 ease-in-out flex items-center justify-center`}
                style={{
                  background: 'conic-gradient(from 0deg, #111 0deg 60deg, #1a1a1a 60deg 120deg, #111 120deg 180deg, #1a1a1a 180deg 240deg, #111 240deg 300deg, #1a1a1a 300deg 360deg)',
                  clipPath: state.isPoweredOn ? 'circle(0% at 50% 50%)' : 'circle(100% at 50% 50%)',
                }}
              >
                {/* Power Icon on Shutter */}
                <div className={`text-white/20 group-hover:text-white/60 transition-colors duration-300 ${state.isPoweredOn ? 'opacity-0' : 'opacity-100'}`}>
                  <i className="fas fa-power-off text-3xl" />
                </div>
              </div>

              {/* Lens Reflection/Glass Overlay */}
              <div className="absolute inset-0 rounded-full shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none mix-blend-overlay" />
            </div>

            {/* Shutter Button - Mapped to left 18% as requested */}
            <button
              onClick={takePhoto}
              disabled={!state.permissionGranted || state.isCapturing || !!pendingPhoto || shotsLeft <= 0 || isReloading || !state.isPoweredOn}
              className={`absolute w-[15%] aspect-square rounded-full focus:outline-none group transition-all z-50 ${!!pendingPhoto || shotsLeft <= 0 || isReloading || !state.isPoweredOn ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
              style={{
                top: '48%',
                left: '18%'
              }}
              aria-label="Take Photo"
            >
              <div className={`w-full h-full rounded-full transition-colors duration-200 ${!!pendingPhoto || shotsLeft <= 0 || isReloading || !state.isPoweredOn ? '' : 'hover:bg-white/10 active:bg-white/20'}`} />
            </button>

            {/* Film Counter */}
            <div
              className="absolute flex flex-col items-center justify-center pointer-events-none"
              style={{ top: '12%', left: '50%', transform: 'translateX(-50%)' }}
            >
              <div className="bg-[#1a1a1a] border-2 border-[#333] rounded px-2 py-1 shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)]">
                <span className={`font-mono font-bold text-lg tracking-widest ${shotsLeft === 0 ? 'text-red-500 animate-pulse' : state.isPoweredOn ? 'text-[#a3d9a5]' : 'text-[#a3d9a5]/20'}`}>
                  {state.isPoweredOn ? shotsLeft : '--'}
                </span>
              </div>
              <span className="text-[8px] text-white/40 font-sans mt-1 tracking-wider">SHOTS</span>
            </div>

            {/* Reload Indicator / Button */}
            {state.isPoweredOn && shotsLeft === 0 && !isReloading && (
              <button
                onClick={handleReload}
                className="absolute z-50 bg-red-600 hover:bg-red-500 text-white font-fredericka text-sm px-3 py-1 rounded shadow-lg animate-bounce cursor-pointer pointer-events-auto tracking-widest"
                style={{ top: '25%', left: '50%', transform: 'translateX(-50%)' }}
              >
                RELOAD
              </button>
            )}

            {/* Reloading Animation Overlay */}
            {isReloading && (
              <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/20 backdrop-blur-[1px] rounded-[3rem]">
                <div className="text-white font-mono text-sm animate-pulse">RELOADING...</div>
              </div>
            )}
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

            {/* Auth Button */}
            <button
              onClick={() => user ? supabase.auth.signOut() : setIsAuthOpen(true)}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-white/80 font-mono text-xs flex items-center gap-2 transition-colors"
            >
              <i className={`fas ${user ? 'fa-sign-out-alt' : 'fa-user'}`} />
              {user ? 'Logout' : 'Login'}
            </button>
            <div className="flex gap-2 lg:gap-4">
              {/* Flash removed from here */}
              <RetroSwitch isOn={isAiEnabled} onToggle={() => setIsAiEnabled(!isAiEnabled)} label="AI" />
            </div>
            <div className="flex items-center gap-2">
              {/* Room Input */}
              <div className="flex items-center border-l border-white/10 pl-2 ml-1 lg:pl-3">
                <span className="text-white/50 font-mono text-xs mr-2 hidden lg:inline">ROOM:</span>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="global"
                  className="bg-transparent border-b border-white/30 text-white font-mono text-xs lg:text-sm px-1 py-1 outline-none focus:border-accent w-20 lg:w-24 placeholder:text-white/30 transition-opacity text-center uppercase"
                  maxLength={10}
                />
              </div>

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