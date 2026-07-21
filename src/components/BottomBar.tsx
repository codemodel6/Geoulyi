import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, ImageIcon, SwitchCamera, Timer, User } from 'lucide-react-native';
import type { TimerMode } from '../hooks/useCameraController';

type Props = {
  lastPhotoUri?: string;
  timerMode: TimerMode;
  mirrored: boolean;
  isCapturing: boolean;
  onPressGallery: () => void;
  onPressTimer: () => void;
  onPressCapture: () => void;
  onPressMirrorToggle: () => void;
  onPressSwitchCamera: () => void;
};

const INACTIVE_CIRCLE = 'h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-transparent';
const ACTIVE_CIRCLE = 'h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-white';

export function BottomBar({
  lastPhotoUri,
  timerMode,
  mirrored,
  isCapturing,
  onPressGallery,
  onPressTimer,
  onPressCapture,
  onPressMirrorToggle,
  onPressSwitchCamera,
}: Props) {
  const insets = useSafeAreaInsets();
  const timerActive = timerMode !== 'off';

  return (
    <View
      className="flex-row items-center justify-evenly bg-black px-2 pt-3"
      style={{ paddingBottom: insets.bottom + 16 }}
    >
      <Pressable onPress={onPressGallery}>
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/40">
          {lastPhotoUri ? (
            <Image source={{ uri: lastPhotoUri }} className="h-full w-full" />
          ) : (
            <ImageIcon color="#fff" size={22} />
          )}
        </View>
      </Pressable>

      <Pressable onPress={onPressTimer}>
        <View className={INACTIVE_CIRCLE}>
          {timerActive ? (
            <Text className="text-base font-bold text-white">{timerMode}</Text>
          ) : (
            <Timer color="#fff" size={22} />
          )}
        </View>
      </Pressable>

      <Pressable onPress={onPressCapture} disabled={isCapturing}>
        <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10">
          <Camera color="#fff" size={30} />
        </View>
      </Pressable>

      <Pressable onPress={onPressMirrorToggle}>
        <View className={mirrored ? INACTIVE_CIRCLE : ACTIVE_CIRCLE}>
          <User color={mirrored ? '#fff' : '#000'} size={22} />
        </View>
      </Pressable>

      <Pressable onPress={onPressSwitchCamera}>
        <View className={INACTIVE_CIRCLE}>
          <SwitchCamera color="#fff" size={22} />
        </View>
      </Pressable>
    </View>
  );
}
