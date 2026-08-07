import { useRef, useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { Camera } from 'react-native-vision-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PREVIEW_ASPECT_RATIO, useCameraController } from '../hooks/useCameraController';
import { TopBar } from '../components/TopBar';
import { BottomBar } from '../components/BottomBar';
import { SettingsScreen } from './SettingsScreen';
import { GalleryViewerScreen } from './GalleryViewerScreen';

export function CameraScreen() {
  const controller = useCameraController();
  const insets = useSafeAreaInsets();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const previewRef = useRef<View>(null);
  // 3:4 박스는 화면 정중앙에 위치해 화면 맨 아래(BottomBar 기본 위치)와의 사이에 빈 검은 공간이
  // 생긴다. 버튼이 사진에서 멀어 보이지 않도록, 박스의 실제 아래쪽 끝 위치를 측정해 BottomBar를
  // 그 자리에 바로 붙인다.
  const [previewBoxBottom, setPreviewBoxBottom] = useState<number | null>(null);

  const openGallery = () => {
    setGalleryVisible(true);
  };

  const handlePause = async () => {
    if (!previewRef.current) return;
    // 캡처(~170ms) 결과를 기다린 뒤에 화면을 바꾸면 버튼을 눌러도 반응이 없는 것처럼 느껴진다.
    // 그래서 누르는 즉시 바부터 숨기고(paused=true), 캡처가 끝나는 대로 정지 이미지를 끼워 넣는다.
    // 그 사이 짧은 틈에는 라이브 프리뷰가 그대로 보인다. 해상도는 원본 그대로 유지한다.
    controller.pause();
    try {
      const uri = await captureRef(previewRef, { format: 'jpg', quality: 0.95 });
      controller.setFrozenImage(uri);
    } catch {
      controller.cancelPause();
    }
  };

  const previewTransformStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: controller.mirrored ? -1 : 1 }],
  }));

  if (!controller.hasPermission) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-black px-8">
        <Text className="text-center text-white">
          카메라를 사용하려면 카메라 접근 권한이 필요합니다.
        </Text>
        <Pressable
          onPress={controller.requestPermission}
          className="rounded-full bg-yellow-400 px-6 py-3"
        >
          <Text className="font-semibold text-black">권한 허용하기</Text>
        </Pressable>
      </View>
    );
  }

  if (!controller.device) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Text className="text-center text-white">사용 가능한 카메라를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* 하단 내비게이션 바(3버튼 제스처 등) 영역만큼 아래를 비워야, 3:4 박스가 화면 전체 높이
          기준이 아니라 실제로 보이는 영역 기준으로 중앙에 와서 위/아래 여백이 같아진다. */}
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: 'black',
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{ width: '100%', aspectRatio: PREVIEW_ASPECT_RATIO, overflow: 'hidden' }}
          onLayout={(e) => setPreviewBoxBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        >
          <Animated.View style={[{ flex: 1 }, previewTransformStyle]}>
            <View ref={previewRef} collapsable={false} style={{ flex: 1 }}>
              <Camera
                ref={controller.cameraRef}
                style={{ flex: 1 }}
                device={controller.device}
                isActive={controller.isAppActive}
                outputs={[controller.photoOutput]}
                constraints={[{ resolutionBias: controller.photoOutput }, { binned: false }]}
                mirrorMode="off"
                implementationMode="compatible"
                onStarted={controller.onCameraStarted}
                onStopped={controller.onCameraStopped}
              />
            </View>
          </Animated.View>

          {controller.paused ? (
            <Pressable
              onPress={controller.resume}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              {controller.frozenUri ? (
                <Image
                  source={{ uri: controller.frozenUri }}
                  style={{
                    width: '100%',
                    height: '100%',
                    transform: [{ scaleX: controller.mirrored ? -1 : 1 }],
                  }}
                  resizeMode="cover"
                />
              ) : null}
            </Pressable>
          ) : null}
        </View>
      </View>

      {!controller.paused && (
        <>
          <TopBar
            flash={controller.flash}
            onCycleFlash={controller.cycleFlash}
            onPressSettings={() => setSettingsVisible(true)}
          />

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              top: previewBoxBottom ?? undefined,
              justifyContent: 'center',
            }}
          >
            <BottomBar
              lastScreenshotUri={controller.lastScreenshotUri}
              mirrored={controller.mirrored}
              onPressGallery={openGallery}
              onPressAI={() => {}} // 기능은 추후 구현 예정, 버튼만 우선 배치
              onPressPause={handlePause}
              onPressMirrorToggle={controller.toggleMirrored}
              onPressSwitchCamera={controller.toggleFacing}
            />
          </View>
        </>
      )}

      <Modal
        visible={settingsVisible}
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <SettingsScreen onClose={() => setSettingsVisible(false)} />
      </Modal>

      <Modal
        visible={galleryVisible}
        animationType="slide"
        onRequestClose={() => setGalleryVisible(false)}
      >
        <GalleryViewerScreen onClose={() => setGalleryVisible(false)} />
      </Modal>
    </View>
  );
}
