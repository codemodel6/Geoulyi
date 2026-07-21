import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
  type FlashMode as VisionFlashMode,
} from 'react-native-vision-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Asset, AssetField, MediaType, Query, getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';

export type FlashMode = VisionFlashMode;
export type TimerMode = 'off' | 3 | 10;
export type CameraFacing = 'front' | 'back';

const FALLBACK_MIN_ZOOM = 1;
const FALLBACK_MAX_ZOOM = 1;

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * 화면에 보이는 미리보기 영역(상단바/하단바를 제외한 부분)의 가로세로 비율에 맞춰
 * 촬영된 사진을 중앙 기준으로 잘라낸다(미리보기의 기본 resizeMode인 'cover'와 동일한 방식).
 * 카메라 센서의 기본 촬영 비율(예: 4:3)은 화면 비율과 다르기 때문에 이 크롭이 없으면
 * 화면에는 안 보이던 부분(상/하 또는 좌/우)까지 사진에 포함된다.
 */
function computeCoverCrop(imageWidth: number, imageHeight: number, targetAspect: number) {
  const currentAspect = imageWidth / imageHeight;
  if (currentAspect > targetAspect) {
    const width = Math.round(imageHeight * targetAspect);
    const originX = Math.round((imageWidth - width) / 2);
    return { originX, originY: 0, width, height: imageHeight };
  }
  const height = Math.round(imageWidth / targetAspect);
  const originY = Math.round((imageHeight - height) / 2);
  return { originX: 0, originY, width: imageWidth, height };
}

/**
 * CameraX의 setZoom은 이전 호출이 아직 진행 중일 때 새 호출이 들어오면
 * "Cancelled..." 예외로 거부한다. 슬라이더를 빠르게 드래그하면 겹쳐서 uncaught rejection이
 * 쌓이므로, 항상 최대 1개만 진행시키고 그 사이 들어온 값은 최신 값으로 합쳐서 다음 차례에 적용한다.
 */
function createSerializedApplier<T>(apply: (value: T) => Promise<void>) {
  let inFlight = false;
  let pending: T | null = null;

  const run = (value: T) => {
    if (inFlight) {
      pending = value;
      return;
    }
    inFlight = true;
    apply(value)
      .catch(() => {})
      .finally(() => {
        inFlight = false;
        if (pending !== null) {
          const next = pending;
          pending = null;
          run(next);
        }
      });
  };

  return run;
}

export function useCameraController() {
  const cameraRef = useRef<CameraRef>(null);

  const { hasPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<CameraFacing>('front');
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [mirrored, setMirrored] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [timerMode, setTimerMode] = useState<TimerMode>('off');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastPhotoUri, setLastPhotoUri] = useState<string | undefined>();
  const [cameraReady, setCameraReady] = useState(false);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  const device = useCameraDevice(facing);
  const photoOutput = usePhotoOutput();

  useEffect(() => {
    setCameraReady(false);
  }, [device]);

  const applyZoomRef = useRef(
    createSerializedApplier<number>((value) => {
      const controller = cameraRef.current?.controller;
      if (!controller) return Promise.resolve();
      return controller.setZoom(value);
    })
  );

  const setZoom = useCallback((value: number) => {
    setZoomState(value);
    applyZoomRef.current(value);
  }, []);

  const handleCameraStarted = useCallback(() => {
    setCameraReady(true);
    applyZoomRef.current(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCameraStopped = useCallback(() => {
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const refreshLastPhoto = useCallback(async () => {
    try {
      const assets = await new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .limit(1)
        .exe();
      if (assets[0]) {
        setLastPhotoUri(assets[0].id);
      }
    } catch {
      // 갤러리 접근 권한이 없거나 사진이 없는 경우 무시
    }
  }, []);

  useEffect(() => {
    (async () => {
      const current = await getPermissionsAsync(false, ['photo']);
      if (current.status !== 'granted') {
        await requestPermissionsAsync(false, ['photo']);
      }
      refreshLastPhoto();
    })();
  }, [refreshLastPhoto]);

  const cycleFlash = useCallback(() => {
    setFlash((prev) => (prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto'));
  }, []);

  const toggleMirrored = useCallback(() => {
    setMirrored((prev) => !prev);
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }, []);

  const cycleTimer = useCallback(() => {
    setTimerMode((prev) => (prev === 'off' ? 3 : prev === 3 ? 10 : 'off'));
  }, []);

  const minZoom = device?.minZoom ?? FALLBACK_MIN_ZOOM;
  const maxZoom = device?.maxZoom ?? FALLBACK_MAX_ZOOM;

  const focusAt = useCallback((point: { x: number; y: number }) => {
    cameraRef.current?.focusTo(point).catch(() => {});
  }, []);

  const previewAspectRatioRef = useRef<number | null>(null);
  const setPreviewSize = useCallback((size: { width: number; height: number }) => {
    if (size.width > 0 && size.height > 0) {
      previewAspectRatioRef.current = size.width / size.height;
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!photoOutput || isCapturing) return;
    setIsCapturing(true);
    try {
      const file = await photoOutput.capturePhotoToFile({ flashMode: flash, enableShutterSound: false }, {});
      const capturedUri = toFileUri(file.filePath);

      let context = ImageManipulator.manipulate(capturedUri);
      if (mirrored) {
        context = context.flip('horizontal');
      }
      let image = await context.renderAsync();

      const targetAspect = previewAspectRatioRef.current;
      if (targetAspect) {
        const crop = computeCoverCrop(image.width, image.height, targetAspect);
        image = await ImageManipulator.manipulate(image).crop(crop).renderAsync();
      }

      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
      const asset = await Asset.create(saved.uri);
      setLastPhotoUri(asset.id);
    } finally {
      setIsCapturing(false);
    }
  }, [flash, mirrored, photoOutput, isCapturing]);

  const takePhoto = useCallback(() => {
    if (timerMode === 'off') {
      capturePhoto();
      return;
    }
    let remaining = timerMode;
    setCountdown(remaining);
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setCountdown(null);
        capturePhoto();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [timerMode, capturePhoto]);

  return {
    cameraRef,
    device,
    photoOutput,
    cameraReady,
    isAppActive,
    onCameraStarted: handleCameraStarted,
    onCameraStopped: handleCameraStopped,
    hasPermission,
    requestPermission,
    facing,
    toggleFacing,
    flash,
    cycleFlash,
    mirrored,
    toggleMirrored,
    zoom,
    setZoom,
    minZoom,
    maxZoom,
    timerMode,
    cycleTimer,
    countdown,
    isCapturing,
    lastPhotoUri,
    focusAt,
    setPreviewSize,
    takePhoto,
  };
}

export type CameraController = ReturnType<typeof useCameraController>;
