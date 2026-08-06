import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  useCameraDevice,
  useCameraPermission,
  type CameraRef,
  type FlashMode as VisionFlashMode,
} from 'react-native-vision-camera';
import {
  Album,
  AssetField,
  MediaType,
  Query,
  addListener,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';

export type FlashMode = VisionFlashMode;
export type CameraFacing = 'front' | 'back';

const FALLBACK_MIN_ZOOM = 1;
const FALLBACK_MAX_ZOOM = 1;

const DEFAULT_ZOOM = 1;

/**
 * 기본 줌은 기기 범위의 비율이 아니라 고정값이다.
 * 갤럭시 S25 Ultra 실기기 테스트에서 2.5x/1.0x 등을 거쳐, "화각보다 인물 왜곡 방지가 우선"이라는
 * 사용자 결정에 따라 살짝 줌인된 값(1.4x)으로 확정 — 광각으로 가까이서 찍을수록 얼굴이 부풀어
 * 보이는 렌즈 왜곡이 커지므로, 살짝 멀리서 찍은 듯한 비율이 되도록 줌인한다.
 * 전면 카메라는 minZoom이 1이라 이 값이 minZoom보다 커야만 왜곡 방지 효과가 실제로 발생한다(같으면 무효).
 * device.minZoom을 그대로 쓰지 않는 이유: 후면처럼 초광각 렌즈가 있는 기기는 minZoom이 1 미만(예: 0.6)이라
 * 그대로 쓰면 왜곡 방지 없이 초광각 화면이 된다. 기기 범위를 벗어나면 범위 안으로 clamp한다.
 */
function defaultFlatteringZoom(minZoom: number, maxZoom: number) {
  return Math.min(Math.max(DEFAULT_ZOOM, minZoom), maxZoom);
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
  const [paused, setPaused] = useState(false);
  const [frozenUri, setFrozenUri] = useState<string | undefined>();
  const [lastScreenshotUri, setLastScreenshotUri] = useState<string | undefined>();
  const [cameraReady, setCameraReady] = useState(false);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  const device = useCameraDevice(facing);

  useEffect(() => {
    setCameraReady(false);
  }, [device]);

  const zoomRef = useRef(zoom);

  /**
   * onStarted 콜백이 발생한 시점에도 cameraRef.current.controller가 아직 비어있는 경우가 있다
   * (vision-camera의 onStarted 이벤트와 controller 준비 사이에 짧은 지연이 있음) — 이 경우 그냥
   * 포기하면 최초 기본 줌(DEFAULT_ZOOM)이 조용히 무시된 채 카메라 기본값(1x)으로 남는다.
   * controller가 나타날 때까지 짧게 재시도한다.
   */
  const applyZoomRef = useRef(
    createSerializedApplier<number>(async (value) => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const controller = cameraRef.current?.controller;
        if (controller) {
          await controller.setZoom(value);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })
  );

  const setZoom = useCallback((value: number) => {
    setZoomState(value);
    zoomRef.current = value;
    applyZoomRef.current(value);
  }, []);

  const handleCameraStarted = useCallback(() => {
    setCameraReady(true);
    applyZoomRef.current(zoomRef.current);
  }, []);

  const handleCameraStopped = useCallback(() => {
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (!device) return;
    setZoom(defaultFlatteringZoom(device.minZoom, device.maxZoom));
  }, [device, setZoom]);

  const refreshLastScreenshot = useCallback(async () => {
    try {
      const album = await Album.get('Screenshots');
      if (!album) return;
      const assets = await new Query()
        .album(album)
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .limit(1)
        .exe();
      if (assets[0]) {
        setLastScreenshotUri(assets[0].id);
      }
    } catch {
      // 갤러리 접근 권한이 없거나 스크린샷이 없는 경우 무시
    }
  }, []);

  useEffect(() => {
    (async () => {
      const current = await getPermissionsAsync(false, ['photo']);
      if (current.status !== 'granted') {
        await requestPermissionsAsync(false, ['photo']);
      }
      refreshLastScreenshot();
    })();

    const subscription = addListener(() => {
      refreshLastScreenshot();
    });
    return () => subscription.remove();
  }, [refreshLastScreenshot]);

  const cycleFlash = useCallback(() => {
    setFlash((prev) => (prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto'));
  }, []);

  const toggleMirrored = useCallback(() => {
    setMirrored((prev) => !prev);
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }, []);

  const minZoom = device?.minZoom ?? FALLBACK_MIN_ZOOM;
  const maxZoom = device?.maxZoom ?? FALLBACK_MAX_ZOOM;

  /**
   * 정지 이미지 캡처(react-native-view-shot)는 매번 ~170ms가 걸려서(해상도를 낮춰도 줄지 않음 —
   * 병목이 TextureView 픽셀 readback 자체로 보임), 캡처가 끝난 뒤에야 화면을 바꾸면 버튼을 눌러도
   * 반응이 없는 것처럼 느껴진다. 그래서 누르는 즉시 상/하단 바부터 숨기고(paused=true), 캡처가
   * 끝나는 대로 정지 이미지를 끼워 넣는다(setFrozenImage) — 그 사이 짧은 틈에는 라이브 프리뷰가
   * 그대로 보인다.
   */
  const pause = useCallback(() => {
    setPaused(true);
  }, []);

  const setFrozenImage = useCallback((uri: string) => {
    setFrozenUri(uri);
  }, []);

  const cancelPause = useCallback(() => {
    setPaused(false);
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
    setFrozenUri(undefined);
    refreshLastScreenshot();
  }, [refreshLastScreenshot]);

  return {
    cameraRef,
    device,
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
    paused,
    frozenUri,
    pause,
    setFrozenImage,
    cancelPause,
    resume,
    lastScreenshotUri,
  };
}

export type CameraController = ReturnType<typeof useCameraController>;
