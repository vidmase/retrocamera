
export interface Photo {
  id: string;
  dataUrl: string;
  timestamp: number;
  caption?: string;
  isDeveloping: boolean;
  isStaticNegative?: boolean;
  isEjecting?: boolean;
  customText?: string;
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
  backNote?: string;
  mediaType?: 'photo' | 'video';
  albumId?: string;
  isShared?: boolean; // true if shared to memory board
  userId?: string; // user who shared/created the photo
}

export interface Album {
  id: string;
  name: string;
  coverColor: string;
  coverPattern: 'leather' | 'fabric' | 'vintage' | 'modern';
  createdAt: number;
  photoCount: number;
  coverPhotoUrl?: string;
}

export interface CameraState {
  stream: MediaStream | null;
  permissionGranted: boolean;
  isFlashOn: boolean;
  isCapturing: boolean;
  isPoweredOn: boolean;
}
