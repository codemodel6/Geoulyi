import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import { Camera } from 'react-native-vision-camera';

import { useCameraController } from '../hooks/useCameraController';
import { TopBar } from '../components/TopBar';
import { BottomBar } from '../components/BottomBar';
import { ZoomSlider } from '../components/ZoomSlider';
import { FocusIndicator } from '../components/FocusIndicator';
import { TimerCountdown } from '../components/TimerCountdown';
import { SettingsScreen } from './SettingsScreen';

export function CameraScreen() {
  const controller = useCameraController();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [bottomAreaHeight, setBottomAreaHeight] = useState(0);

  useEffect(() => {
    const previewHeight = screenHeight - topBarHeight - bottomAreaHeight;
    if (previewHeight > 0) {
      controller.setPreviewSize({ width: screenWidth, height: previewHeight });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenWidth, screenHeight, topBarHeight, bottomAreaHeight]);

  const openGallery = () => {
    if (controller.lastPhotoUri) {
      Linking.openURL(controller.lastPhotoUri).catch(() => {});
    }
  };

  const handleTap = (x: number, y: number) => {
    controller.focusAt({ x, y });
    setFocusPoint({ x, y });
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = setTimeout(() => setFocusPoint(null), 1000);
  };

  const tapGesture = Gesture.Tap().onEnd((event) => {
    runOnJS(handleTap)(event.x, event.y);
  });

  const mirrorStyle = useAnimatedStyle(() => ({
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
      <GestureDetector gesture={tapGesture}>
        <Animated.View style={[{ flex: 1 }, mirrorStyle]}>
          <Camera
            ref={controller.cameraRef}
            style={{ flex: 1 }}
            device={controller.device}
            isActive={controller.isAppActive}
            outputs={controller.photoOutput ? [controller.photoOutput] : []}
            mirrorMode="off"
            implementationMode="compatible"
            onStarted={controller.onCameraStarted}
            onStopped={controller.onCameraStopped}
          />
        </Animated.View>
      </GestureDetector>

      <FocusIndicator point={focusPoint} />

      <TopBar
        flash={controller.flash}
        onCycleFlash={controller.cycleFlash}
        onPressSettings={() => setSettingsVisible(true)}
        onLayout={(e) => setTopBarHeight(e.nativeEvent.layout.height)}
      />

      <View
        className="absolute bottom-0 left-0 right-0"
        onLayout={(e) => setBottomAreaHeight(e.nativeEvent.layout.height)}
      >
        <ZoomSlider
          zoom={controller.zoom}
          minZoom={controller.minZoom}
          maxZoom={controller.maxZoom}
          onChange={controller.setZoom}
        />
        <BottomBar
          lastPhotoUri={controller.lastPhotoUri}
          timerMode={controller.timerMode}
          mirrored={controller.mirrored}
          isCapturing={controller.isCapturing}
          onPressGallery={openGallery}
          onPressTimer={controller.cycleTimer}
          onPressCapture={controller.takePhoto}
          onPressMirrorToggle={controller.toggleMirrored}
          onPressSwitchCamera={controller.toggleFacing}
        />
      </View>

      <TimerCountdown count={controller.countdown} />

      <Modal
        visible={settingsVisible}
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <SettingsScreen onClose={() => setSettingsVisible(false)} />
      </Modal>
    </View>
  );
}
