import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraState, Photo } from './types';
import { RetroSwitch } from './components/RetroSwitch';
import Polaroid from './components/Polaroid';
import { generateCaption } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { AuthModal } from './components/AuthModal';
import { CursorOverlay } from './components/CursorOverlay';
import { AlbumDrawer } from './components/AlbumDrawer';
import { MemoryBoard } from './components/MemoryBoard';
import { MemoryBoardDropZone } from './components/MemoryBoardDropZone';
import { LiquidFlowEffect } from './components/LiquidFlowEffect';

// Simple throttle utility
const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean;
  return function (this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
};

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
  const memoriesButtonRef = useRef<HTMLButtonElement>(null);

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Collaboration State
  const [cursors, setCursors] = useState<Record<string, any>>({});
  const [sharedPhotos, setSharedPhotos] = useState<Photo[]>([]);
  const channelRef = useRef<any>(null);

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
  const [isDraggingPending, setIsDraggingPending] = useState(false);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [isAlbumDrawerOpen, setIsAlbumDrawerOpen] = useState(false);
  const [isMemoryBoardOpen, setIsMemoryBoardOpen] = useState(false);
  const [liquidFlowPhoto, setLiquidFlowPhoto] = useState<Photo | null>(null);
  const [liquidFlowStart, setLiquidFlowStart] = useState({ x: 0, y: 0 });
  const [liquidFlowEnd, setLiquidFlowEnd] = useState({ x: 0, y: 0 });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const playPrinting = usePrintingSound();
  const playReload = useReloadSound();
  const playShutter = useShutterSound();

  // Load & Subscribe to Photos & Broadcasts
  // Fetch shared photos for the Memory Board
  useEffect(() => {
    let ignore = false;

    const fetchSharedPhotos = async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('id, created_at, data_url, caption, x, y, rotation, z_index, album_id, user_id, is_shared')
        .eq('is_shared', true)
        .order('created_at', { ascending: true })
        .limit(100);

      if (!ignore && data) {
        const mapped: Photo[] = data.map((p: any) => {
          const isNormalized = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
          return {
            id: p.id,
            dataUrl: p.data_url,
            timestamp: new Date(p.created_at).getTime(),
            isDeveloping: false,
            isStaticNegative: false,
            isEjecting: false,
            caption: p.caption,
            x: isNormalized ? p.x * window.innerWidth : p.x,
            y: isNormalized ? p.y * window.innerHeight : p.y,
            rotation: p.rotation,
            zIndex: p.z_index,
            customText: p.caption ? undefined : "Shared Memory",
            mediaType: p.data_url?.startsWith('data:video') ? 'video' : 'photo',
            albumId: p.album_id,
            isShared: true,
            userId: p.user_id
          };
        });
        setSharedPhotos(mapped);
      }
    };

    fetchSharedPhotos();

    // Subscribe to new shared photos
    const channel = supabase
      .channel('memory-board')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos', filter: 'is_shared=eq.true' }, (payload) => {
        if (ignore) return;

        const p = payload.new as any;
        const isNormalized = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

        const newPhoto: Photo = {
          id: p.id,
          dataUrl: p.data_url,
          timestamp: new Date(p.created_at).getTime(),
          isDeveloping: false,
          isStaticNegative: false,
          isEjecting: false,
          caption: p.caption,
          x: isNormalized ? p.x * window.innerWidth : p.x,
          y: isNormalized ? p.y * window.innerHeight : p.y,
          rotation: p.rotation,
          zIndex: p.z_index,
          customText: p.caption ? undefined : "Shared Memory",
          mediaType: p.data_url?.startsWith('data:video') ? 'video' : 'photo',
          albumId: p.album_id,
          isShared: true,
          userId: p.user_id
        };

        setSharedPhotos(prev => {
          if (prev.find(existing => existing.id === newPhoto.id)) return prev;
          return [...prev, newPhoto];
        });
      })
      .on('broadcast', { event: 'FLASH' }, () => {
        setShowPageFlash(true);
        setTimeout(() => setShowPageFlash(false), 400);
      })
      .on('broadcast', { event: 'CURSOR' }, (payload) => {
        if (!user) return;
        const { userId, x, y, color } = payload.payload;
        if (userId === user.id) return;

        setCursors(prev => ({
          ...prev,
          [userId]: { x, y, color, lastUpdate: Date.now() }
        }));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user]);

  // Broadcast Mouse Movement
  const handleMouseMove = useCallback(throttle((e: React.MouseEvent) => {
    if (!user || !channelRef.current) return;

    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;

    const colorHash = user.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const hue = colorHash % 360;
    const color = `hsl(${hue}, 70%, 60%)`;

    channelRef.current.send({
      type: 'broadcast',
      event: 'CURSOR',
      payload: { userId: user.id, x, y, color }
    });
  }, 100), [user]);

  // Clean up old cursors
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors(prev => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        Object.entries(next).forEach(([id, cursor]: [string, any]) => {
          if (now - cursor.lastUpdate > 2000) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

    if (pendingPhoto && pendingPhoto.id === id) {
      setPendingPhoto(p => p ? { ...p, isEjecting: false } : null);
    }
  };

  const ejectMedia = (url: string, type: 'photo' | 'video') => {
    playPrinting();

    let spawnX = 100;
    let spawnY = 100;

    if (cameraBodyRef.current) {
      const rect = cameraBodyRef.current.getBoundingClientRect();
      const halfWidth = window.innerWidth < 640 ? 88 : 104;
      spawnX = rect.left + (rect.width / 2) - halfWidth;
      spawnY = rect.bottom - 60;
    }

    const newPhoto: Photo = {
      id: crypto.randomUUID(),
      dataUrl: url,
      timestamp: Date.now(),
      isDeveloping: false,
      isStaticNegative: type === 'photo',
      isEjecting: true,
      // If AI is OFF, use the custom text as the main caption so it persists
      caption: isAiEnabled ? undefined : customText,
      customText: undefined,
      x: spawnX,
      y: spawnY,
      rotation: 0,
      zIndex: 1,
      mediaType: type
    };

    setPendingPhoto(newPhoto);

    if (isAiEnabled && type === 'photo') {
      generateCaption(url).then(caption => {
        setPendingPhoto(curr => {
          if (curr && curr.id === newPhoto.id) {
            return { ...curr, caption };
          }
          return curr;
        });
      });
    }

    setTimeout(() => {
      setState(prev => ({ ...prev, isCapturing: false }));
      setIsRecording(false);
    }, 500);

    setTimeout(() => {
      setPendingPhoto(curr => curr ? { ...curr, isEjecting: false } : null);
    }, 3000);
  };

  const takePhoto = async () => {
    if (pendingPhoto) return;

    // Check if user is logged in
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    if (shotsLeft <= 0 || isReloading || !state.isPoweredOn) return;

    if (!videoRef.current || !canvasRef.current || state.isCapturing || isRecording) return;

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    // Broadcast Flash Event (only for photo?)
    if (mode === 'photo' && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'FLASH'
      });
    }

    if (mode === 'video') {
      const stream = state.stream;
      if (!stream) return;

      setIsRecording(true);
      playShutter(); // Start sound

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 1000000 // 1 Mbps
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        // Convert to Base64 Data URL for storage/compatibility
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          ejectMedia(base64data, 'video');
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 3000);
      return;
    }

    playShutter();
    setState(prev => ({ ...prev, isCapturing: true }));
    setShotsLeft(prev => prev - 1);

    // Calculate flash burst position
    if (state.isFlashOn) {
      if (cameraBodyRef.current) {
        const rect = cameraBodyRef.current.getBoundingClientRect();
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

      const flash = document.getElementById('camera-flash');
      if (flash && state.isFlashOn) {
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.opacity = '0'; }, 100);
      }

      setTimeout(() => {
        ejectMedia(dataUrl, 'photo');
      }, 4000);
    }
  };

  const handlePendingDragEnd = async (id: string, x: number, y: number) => {
    if (!pendingPhoto || pendingPhoto.id !== id) return;

    const rotation = (Math.random() * 10 - 5);
    const zIndex = maxZIndex + 1;

    // Save photo locally (not to Supabase - user can share to Memory Board later)
    const finalPhoto: Photo = {
      ...pendingPhoto,
      x: x,
      y: y,
      isEjecting: false,
      isDeveloping: true,
      isStaticNegative: false,
      rotation: rotation,
      zIndex: zIndex,
      isShared: false
    };
    setPhotos(prev => [...prev, finalPhoto]);
    setTimeout(() => {
      setPhotos(prev => prev.map(p => p.id === id ? { ...p, isDeveloping: false } : p));
    }, 5200);

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
    }, 2000);
  };

  const handlePhotoAddedToAlbum = (photoId: string, albumId: string) => {
    setPhotos(prev => prev.map(p =>
      p.id === photoId ? { ...p, albumId } : p
    ));
  };

  const handleShareToMemoryBoard = async (photo: Photo, dropPosition?: { x: number; y: number }) => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    // Check if already shared
    if (photo.isShared) return;

    // Calculate start position (from photo's current position or drop position)
    const startX = dropPosition?.x ?? (photo.x + 64); // Center of polaroid
    const startY = dropPosition?.y ?? (photo.y + 80);
    
    // End position - target the Memories button
    let endX = window.innerWidth - 200;
    let endY = window.innerHeight - 50;
    
    if (memoriesButtonRef.current) {
      const rect = memoriesButtonRef.current.getBoundingClientRect();
      endX = rect.left + rect.width / 2;
      endY = rect.top + rect.height / 2;
    }

    // Trigger liquid flow effect
    setLiquidFlowStart({ x: startX, y: startY });
    setLiquidFlowEnd({ x: endX, y: endY });
    setLiquidFlowPhoto(photo);

    const rotation = (Math.random() * 10 - 5);
    const zIndex = maxZIndex + 1;
    const x = 0.1 + Math.random() * 0.8;
    const y = 0.1 + Math.random() * 0.8;

    // Save to Supabase as shared
    const { error } = await supabase.from('photos').insert({
      user_id: user.id,
      data_url: photo.dataUrl,
      caption: photo.caption,
      x: x,
      y: y,
      rotation: rotation,
      z_index: zIndex,
      is_shared: true
    });

    if (!error) {
      // Mark local photo as shared
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { ...p, isShared: true } : p
      ));
      setMaxZIndex(prev => prev + 1);
    } else {
      console.error('Error sharing photo:', error);
    }
  };

  const handleOpenMemoryBoard = () => {
    setIsMemoryBoardOpen(true);
  };

  return (
    <div className="relative h-[100dvh] w-full bg-stone-900 overflow-hidden font-sans selection:bg-accent selection:text-white touch-none">
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={() => setIsAuthOpen(false)}
      />

      {/* Album Drawer */}
      <AlbumDrawer
        isOpen={isAlbumDrawerOpen}
        onClose={() => setIsAlbumDrawerOpen(false)}
        user={user}
        photos={photos}
        onPhotoAddedToAlbum={handlePhotoAddedToAlbum}
      />

      {/* Photo Pool */}
      {/* Memory Board */}
      <MemoryBoard
        isOpen={isMemoryBoardOpen}
        onClose={() => setIsMemoryBoardOpen(false)}
        sharedPhotos={sharedPhotos}
        onPhotoDrop={handleShareToMemoryBoard}
        onPhotoClick={(photo) => {
          setIsMemoryBoardOpen(false);
        }}
      />

      {/* Memory Board Drop Zone (Floating) */}
      <MemoryBoardDropZone
        isVisible={!isMemoryBoardOpen && photos.filter(p => !p.isShared).length > 0}
        onDrop={(photo, position) => handleShareToMemoryBoard(photo, position)}
        onOpenBoard={() => setIsMemoryBoardOpen(true)}
        sharedCount={sharedPhotos.length}
      />

      {/* Liquid Flow Effect */}
      <LiquidFlowEffect
        photo={liquidFlowPhoto}
        startPosition={liquidFlowStart}
        endPosition={liquidFlowEnd}
        onComplete={() => {
          // Remove the photo from local gallery after effect completes
          if (liquidFlowPhoto) {
            setPhotos(prev => prev.filter(p => p.id !== liquidFlowPhoto.id));
          }
          setLiquidFlowPhoto(null);
        }}
      />

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#f0f0f0] w-full max-w-sm p-8 rounded-sm shadow-2xl relative border-4 border-white outline outline-2 outline-gray-400 transform animate-scale-in">
            {/* Polaroid-style corners */}
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
            <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />

            {/* Camera Icon */}
            <div className="text-center mb-4">
              <i className="fas fa-camera-retro text-5xl text-accent drop-shadow-lg animate-pulse" />
            </div>

            {/* Message */}
            <div className="text-center mb-6">
              <h2 className="font-fredericka text-2xl text-gray-800 tracking-widest mb-2">
                Wait! 📸
              </h2>
              <p className="font-mono text-sm text-gray-600 leading-relaxed">
                Sure you want to leave?<br />
                The memories will miss you!
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  supabase.auth.signOut();
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-mono uppercase tracking-widest py-3 px-4 transition-all transform hover:scale-105 active:scale-95 shadow-lg border-2 border-red-700"
              >
                Yes, Leave
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-gray-800 hover:bg-accent text-white font-mono uppercase tracking-widest py-3 px-4 transition-all transform hover:scale-105 active:scale-95 shadow-lg border-2 border-gray-900"
              >
                Stay
              </button>
            </div>

            {/* Decorative tape */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-yellow-200/80 border border-yellow-300 transform -rotate-1 pointer-events-none shadow-md" />
            <div className="absolute -bottom-4 right-1/4 w-16 h-6 bg-yellow-200/80 border border-yellow-300 transform rotate-1 pointer-events-none shadow-md" />
          </div>
        </div>
      )}

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#f0f0f0] w-full max-w-sm p-8 rounded-sm shadow-2xl relative border-4 border-white outline outline-2 outline-gray-400 transform animate-scale-in">
            {/* Polaroid-style corners */}
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
            <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />

            {/* Camera Icon */}
            <div className="text-center mb-4">
              <i className="fas fa-camera-retro text-5xl text-accent drop-shadow-lg animate-pulse" />
            </div>

            {/* Message */}
            <div className="text-center mb-6">
              <h2 className="font-fredericka text-2xl text-gray-800 tracking-widest mb-2">
                Hold On! 📸
              </h2>
              <p className="font-mono text-sm text-gray-600 leading-relaxed">
                You need to log in<br />
                to capture memories!
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLoginPrompt(false);
                  setIsAuthOpen(true);
                }}
                className="flex-1 bg-accent hover:bg-accent/90 text-white font-mono uppercase tracking-widest py-3 px-4 transition-all transform hover:scale-105 active:scale-95 shadow-lg border-2 border-accent/80"
              >
                Login
              </button>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-mono uppercase tracking-widest py-3 px-4 transition-all transform hover:scale-105 active:scale-95 shadow-lg border-2 border-gray-900"
              >
                Cancel
              </button>
            </div>

            {/* Decorative tape */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-yellow-200/80 border border-yellow-300 transform -rotate-1 pointer-events-none shadow-md" />
            <div className="absolute -bottom-4 right-1/4 w-16 h-6 bg-yellow-200/80 border border-yellow-300 transform rotate-1 pointer-events-none shadow-md" />
          </div>
        </div>
      )}

      {/* Flash Burst Effect */}
      {showPageFlash && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            top: flashBurstPos ? flashBurstPos.y : '50%',
            left: flashBurstPos ? flashBurstPos.x : '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-white rounded-full animate-flash-burst shadow-[0_0_100px_50px_rgba(255,255,255,0.8)]" />
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/80 rounded-full blur-2xl animate-flash-core" />
          <div className="absolute top-1/2 left-1/2 w-8 h-8 bg-white rounded-full shadow-[0_0_50px_20px_white] animate-flash-core" />
          <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center">
            <div className="w-[150vmax] h-[2px] bg-gradient-to-r from-transparent via-white to-transparent animate-flash-ray" />
          </div>
          <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center rotate-90">
            <div className="w-[150vmax] h-[2px] bg-gradient-to-r from-transparent via-white to-transparent animate-flash-ray" />
          </div>
          <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center rotate-45">
            <div className="w-[100vmax] h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent animate-flash-ray" />
          </div>
          <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center -rotate-45">
            <div className="w-[100vmax] h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent animate-flash-ray" />
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* LAYER 1: Backgrounds */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/bg.png')" }}
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* LAYER 2: Pending Photo (Behind Camera initially, then on top) */}
      {/* It stays behind (z-10) until the user starts dragging it (z-50) */}
      <div className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden ${isDraggingPending ? 'z-50' : 'z-10'}`}>
        {pendingPhoto && <div
          className={`absolute ${pendingPhoto.isEjecting ? 'overflow-hidden' : ''} pointer-events-auto`}
          style={{
            left: pendingPhoto.x - 20,
            top: pendingPhoto.y,
            width: window.innerWidth < 640 ? '200px' : '240px',
            height: window.innerWidth < 640 ? '310px' : '360px',
            zIndex: 10
          }}
        >
          <Polaroid
            photo={{ ...pendingPhoto, x: 20, y: 0 }}
            onFocus={() => bringToFront(pendingPhoto.id)}
            onDragStart={() => setIsDraggingPending(true)}
            onDragEnd={(id, x, y) => {
              setIsDraggingPending(false);
              handlePendingDragEnd(id, (pendingPhoto.x - 20) + x, pendingPhoto.y + y);
            }}
            className={pendingPhoto.isEjecting ? "animate-eject" : ""}
          />

          {!pendingPhoto.isEjecting && (
            <div className="absolute z-50 pointer-events-none whitespace-nowrap top-full left-1/2 -translate-x-1/2 mt-4 lg:top-1/2 lg:left-full lg:ml-4 lg:-translate-y-1/2 lg:translate-x-0 lg:mt-0">
              <div className="flex items-center gap-3 animate-bounce flex-col lg:flex-row">
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

      {/* LAYER 3: Foreground UI & Camera */}
      <div className="absolute inset-0 flex flex-col lg:flex-row w-full h-full pointer-events-none z-20">
        <div className="w-full lg:w-[40%] h-[55%] lg:h-full relative flex flex-col justify-start pt-12 lg:justify-center lg:pt-0 lg:pb-32 items-center">
          <div className="absolute top-0 left-0 w-full p-4 lg:p-6 z-40 flex justify-between items-start">
            <div className="flex items-center gap-3 text-white/80 pointer-events-auto w-fit bg-black/20 backdrop-blur-sm p-2 rounded-lg lg:bg-transparent lg:backdrop-blur-none lg:p-0">
              <i className="fas fa-camera-retro text-2xl lg:text-3xl text-accent" />
              <h1 className="text-xl lg:text-3xl font-mono tracking-tighter text-white">RETRO<span className="text-accent">CAM</span>.AI</h1>
            </div>
          </div>

          <div ref={cameraBodyRef} className="relative w-[85vw] max-w-[360px] select-none pointer-events-auto mt-2 lg:mt-0" style={{ transform: 'translateX(-2%)' }}>
            <img
              src="https://www.bubbbly.com/assets/retro-camera.webp"
              alt="Retro Camera"
              className="w-full h-auto drop-shadow-2xl relative pointer-events-none"
            />
            <div
              className={`absolute z-40 cursor-pointer group ${!state.isPoweredOn ? 'pointer-events-none opacity-50' : ''}`}
              style={{ top: '13.5%', left: '14.5%', width: '19%', height: '19%' }}
              onClick={() => state.isPoweredOn && setState(prev => ({ ...prev, isFlashOn: !prev.isFlashOn }))}
              title="Toggle Flash"
            >
              <div className={`relative w-full h-full rounded-xl overflow-hidden transition-all duration-500 ${state.isFlashOn
                ? 'shadow-[inset_0_0_15px_rgba(255,255,255,0.4)]'
                : 'opacity-30 hover:opacity-100' // Show glass hint on hover
                }`}>

                {/* Icon to indicate clickable */}
                {!state.isFlashOn && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    <i className="fas fa-bolt text-white/80 text-lg drop-shadow-md" />
                  </div>
                )}

                {/* Fresnel Lens Texture (Grid pattern) */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(255,255,255,0.1)_3px,transparent_4px)] opacity-30" />
                <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.1)_3px,transparent_4px)] opacity-20" />
                <div className={`absolute inset-0 bg-blue-100/10 transition-opacity duration-700 ${state.isFlashOn ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[15%] rounded-full transition-all duration-500 ${state.isFlashOn
                  ? 'bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.6)] blur-[1px]'
                  : 'bg-white/10'
                  }`} />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-30" />
                <div id="camera-flash" className="absolute inset-0 bg-white opacity-0 pointer-events-none transition-opacity duration-100 mix-blend-hard-light" />
              </div>
            </div>

            <div
              className="absolute w-[30%] aspect-square rounded-full bg-black overflow-hidden shadow-[inset_0_10px_25px_rgba(0,0,0,0.8)] ring-4 ring-[#111] cursor-pointer group"
              style={{
                top: '40%',
                left: '47%'
              }}
              onClick={() => setState(prev => ({ ...prev, isPoweredOn: !prev.isPoweredOn }))}
              title={state.isPoweredOn ? "Turn Off" : "Turn On"}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform scale-[1.35] pointer-events-none transition-opacity duration-700 ${state.isPoweredOn ? 'opacity-100' : 'opacity-0'}`}
              />
              <div
                className={`absolute inset-0 z-20 pointer-events-none transition-all duration-700 ease-in-out flex items-center justify-center`}
                style={{
                  background: 'conic-gradient(from 0deg, #111 0deg 60deg, #1a1a1a 60deg 120deg, #111 120deg 180deg, #1a1a1a 180deg 240deg, #111 240deg 300deg, #1a1a1a 300deg 360deg)',
                  clipPath: state.isPoweredOn ? 'circle(0% at 50% 50%)' : 'circle(100% at 50% 50%)',
                }}
              >
                <div className={`text-white/20 group-hover:text-white/60 transition-colors duration-300 ${state.isPoweredOn ? 'opacity-0' : 'opacity-100'}`}>
                  <i className="fas fa-power-off text-3xl" />
                </div>
              </div>
              <div className="absolute inset-0 rounded-full shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none mix-blend-overlay" />

              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-[15%] right-[15%] z-30 flex items-center gap-2 pointer-events-none">
                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                  <span className="text-red-600 font-mono text-[10px] font-bold tracking-widest drop-shadow-md">REC</span>
                </div>
              )}
            </div>

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

            {state.isPoweredOn && shotsLeft === 0 && !isReloading && (
              <button
                onClick={handleReload}
                className="absolute z-50 bg-red-600 hover:bg-red-500 text-white font-fredericka text-sm px-3 py-1 rounded shadow-lg animate-bounce cursor-pointer pointer-events-auto tracking-widest"
                style={{ top: '25%', left: '50%', transform: 'translateX(-50%)' }}
              >
                RELOAD
              </button>
            )}

            {isReloading && (
              <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/20 backdrop-blur-[1px] rounded-[3rem]">
                <div className="text-white font-mono text-sm animate-pulse">RELOADING...</div>
              </div>
            )}

            {warningMsg && (
              <div className="absolute inset-0 flex items-center justify-center z-50 bg-red-500/20 backdrop-blur-[1px] rounded-[3rem]">
                <div className="text-white font-mono text-xs font-bold animate-bounce tracking-widest px-4 text-center">{warningMsg}</div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-[60%] h-[45%] lg:h-full relative pointer-events-none">
          {/* Gallery Zone - Photos moved to global layer */}
        </div>
      </div>

      {/* LAYER 3.5: Saved Photos (Global Layer) */}
      <div className="absolute inset-0 z-30 w-full h-full pointer-events-none overflow-hidden">
        {photos.filter(photo => !photo.isShared || photo.id === liquidFlowPhoto?.id).map((photo) => (
          <div 
            key={photo.id} 
            className={`pointer-events-auto transition-opacity duration-300 ${
              photo.isShared && photo.id !== liquidFlowPhoto?.id ? 'opacity-0 pointer-events-none' : ''
            }`}
          >
            <Polaroid
              photo={photo}
              onFocus={() => bringToFront(photo.id)}
              onDragEnd={() => { }}
              onShare={handleShareToMemoryBoard}
              enableHtmlDrag={!photo.isShared}
            />
          </div>
        ))}
      </div>

      {/* LAYER 4: Overlay UI */}
      <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-end p-4 lg:p-6">

        {/* Cursor Overlay */}
        <CursorOverlay cursors={cursors} />

        <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-auto lg:static lg:w-full lg:flex-row lg:justify-between lg:items-end lg:gap-0" onMouseMove={handleMouseMove}>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
          >
            <i className="fas fa-cog" />
          </button>

          <div className={`${isSettingsOpen ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row bg-[#151515] lg:bg-black/40 backdrop-blur-xl p-5 lg:p-2 rounded-2xl lg:rounded-xl border border-white/10 gap-5 lg:gap-4 shadow-2xl w-[280px] lg:w-auto mt-2 lg:mt-0 origin-top-right transition-all`}>

            {/* Login Button */}
            <button
              onClick={() => {
                if (user) {
                  setShowLogoutConfirm(true);
                } else {
                  setIsAuthOpen(true);
                }
              }}
              className="w-full lg:w-auto px-4 py-3 lg:py-1 bg-white/5 lg:bg-white/10 hover:bg-white/10 lg:hover:bg-white/20 rounded-xl lg:rounded text-white/90 font-mono text-xs flex items-center justify-center gap-3 lg:gap-2 transition-all border border-white/5 lg:border-transparent"
            >
              <i className={`fas ${user ? 'fa-sign-out-alt' : 'fa-user'}`} />
              {user ? (user.email?.split('@')[0] || 'LOGOUT') : 'LOGIN'}
            </button>

            {/* Switches Group */}
            <div className="flex items-center justify-between px-4 py-3 lg:p-0 bg-white/5 lg:bg-transparent rounded-xl lg:rounded-none border border-white/5 lg:border-none lg:gap-4">
              <RetroSwitch isOn={state.isFlashOn} onToggle={() => setState(prev => ({ ...prev, isFlashOn: !prev.isFlashOn }))} label="FLASH" />
              <div className="w-px h-8 bg-white/10 lg:hidden" />
              <RetroSwitch isOn={isAiEnabled} onToggle={() => setIsAiEnabled(!isAiEnabled)} label="AI" />
              <div className="w-px h-8 bg-white/10 lg:hidden" />
              <RetroSwitch
                isOn={mode === 'video'}
                onToggle={() => setMode(prev => prev === 'photo' ? 'video' : 'photo')}
                label={mode === 'video' ? "VIDEO" : "PHOTO"}
                onLabel=""
                offLabel=""
              />
            </div>

            {/* Custom Text Input */}
            <div className="flex items-center justify-between lg:justify-start gap-3 px-2 lg:px-0 lg:border-l lg:border-white/10 lg:pl-3">
              <span className="text-white/40 font-mono text-[10px] tracking-widest">TEXT</span>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                disabled={isAiEnabled}
                placeholder={isAiEnabled ? "AI AUTO" : "CUSTOM..."}
                className={`bg-transparent border-b border-white/20 text-white font-mono text-sm lg:text-xs px-2 py-1 outline-none focus:border-accent w-36 lg:w-32 text-right lg:text-left placeholder:text-white/20 transition-opacity ${isAiEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                maxLength={20}
              />
            </div>

            {/* Albums Button */}
            <button
              onClick={() => {
                if (!user) {
                  setShowLoginPrompt(true);
                } else {
                  setIsAlbumDrawerOpen(true);
                }
              }}
              className="w-full lg:w-auto px-4 py-3 lg:py-1 bg-accent/10 hover:bg-accent/20 text-accent hover:text-accent/90 border border-accent/20 rounded-xl lg:rounded transition-colors font-fredericka text-sm lg:text-base tracking-widest uppercase flex items-center justify-center gap-2"
              title="My Albums"
            >
              <i className="fas fa-book-open text-sm" />
              Albums
            </button>

            {/* Memory Board Button */}
            <button
              ref={memoriesButtonRef}
              onClick={() => {
                if (user) {
                  setIsMemoryBoardOpen(true);
                }
              }}
              disabled={!user}
              className={`w-full lg:w-auto px-4 py-3 lg:py-1 border rounded-xl lg:rounded transition-colors font-fredericka text-sm lg:text-base tracking-widest uppercase flex items-center justify-center gap-2 group ${
                user
                  ? 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 hover:text-amber-300 border-amber-600/20'
                  : 'bg-amber-600/5 text-amber-400/40 border-amber-600/10 cursor-not-allowed opacity-50'
              }`}
              title={user ? "Memory Board - View shared memories" : "Login to view Memory Board"}
            >
              <i className={`fas fa-thumbtack text-sm ${user ? 'rotate-45 group-hover:rotate-0 transition-transform' : ''}`} />
              Memories
              {user && sharedPhotos.length > 0 && (
                <span className="bg-amber-600/20 text-amber-300 px-2 py-0.5 rounded-full text-xs font-mono">
                  {sharedPhotos.length}
                </span>
              )}
            </button>

            {/* Reset Button */}
            <button
              onClick={() => setPhotos([])}
              className="w-full lg:w-auto px-4 py-3 lg:py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl lg:rounded transition-colors font-fredericka text-sm lg:text-base tracking-widest uppercase"
              title="Reset Photos"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;