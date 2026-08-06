import { useRef, useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { Camera } from 'react-native-vision-camera';

import { useCameraController } from '../hooks/useCameraController';
import { TopBar } from '../components/TopBar';
import { BottomBar } from '../components/BottomBar';
import { SettingsScreen } from './SettingsScreen';
import { GalleryViewerScreen } from './GalleryViewerScreen';

// 얼굴이 살짝 갸름해 보이도록 하는 미세 세로 스트레칭.
// scaleX를 1보다 작게(가로 압축)하면 화면 양옆에 빈 틈(검은 여백)이 생기므로,
// 대신 scaleY를 살짝 키워(세로로 늘림) 같은 "더 갸름한 비율" 효과를 틈 없이 낸다.
const SLIM_SCALE_Y = 1.006;
// 인물 사진에 흔히 쓰이는 4:5 비율로 프리뷰를 잘라 보여준다(화면 전체를 꽉 채우는 세로로 긴
// 비율보다 인물이 더 안정적인 비율로 보임). 남는 위/아래는 검은 레터박스로 채워지는데, 이 박스는
// 라이브/일시정지 상태와 무관하게 항상 같은 위치에 고정해야 일시정지할 때 화면이 튀지 않는다.
const PREVIEW_ASPECT_RATIO = 4 / 5;

export function CameraScreen() {
  const controller = useCameraController();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const previewRef = useRef<View>(null);
  // 4:5 박스는 화면 정중앙에 위치해 화면 맨 아래(BottomBar 기본 위치)와의 사이에 빈 검은 공간이
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
    transform: [{ scaleX: controller.mirrored ? -1 : 1 }, { scaleY: SLIM_SCALE_Y }],
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
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'black' }}>
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
                outputs={[]}
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
                    transform: [{ scaleX: controller.mirrored ? -1 : 1 }, { scaleY: SLIM_SCALE_Y }],
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
