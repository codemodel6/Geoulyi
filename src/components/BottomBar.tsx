import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot, ImageIcon, Pause, SwitchCamera, User } from 'lucide-react-native';

type Props = {
  lastScreenshotUri?: string;
  mirrored: boolean;
  onPressGallery: () => void;
  onPressAI: () => void;
  onPressPause: () => void;
  onPressMirrorToggle: () => void;
  onPressSwitchCamera: () => void;
};

const INACTIVE_CIRCLE = 'h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-transparent';
const ACTIVE_CIRCLE = 'h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-white';

export function BottomBar({
  lastScreenshotUri,
  mirrored,
  onPressGallery,
  onPressAI,
  onPressPause,
  onPressMirrorToggle,
  onPressSwitchCamera,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-evenly bg-black px-2 pt-3"
      style={{ paddingBottom: insets.bottom + 16 }}
    >
      <Pressable onPress={onPressGallery}>
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/40">
          {lastScreenshotUri ? (
            <Image source={{ uri: lastScreenshotUri }} className="h-full w-full" />
          ) : (
            <ImageIcon color="#fff" size={22} />
          )}
        </View>
      </Pressable>

      <Pressable onPress={onPressAI}>
        <View className={INACTIVE_CIRCLE}>
          <Bot color="#fff" size={22} />
        </View>
      </Pressable>

      <Pressable onPress={onPressPause}>
        <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10">
          <Pause color="#fff" size={30} />
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
