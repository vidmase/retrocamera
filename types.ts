
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
}

export interface CameraState {
  stream: MediaStream | null;
  permissionGranted: boolean;
  isFlashOn: boolean;
  isCapturing: boolean;
}
