import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Zap, ZapOff } from 'lucide-react-native';
import type { FlashMode } from '../hooks/useCameraController';

const FLASH_LABEL: Record<FlashMode, string> = {
  auto: '자동',
  on: '켜기',
  off: '끄기',
};

type Props = {
  flash: FlashMode;
  onCycleFlash: () => void;
  onPressSettings: () => void;
  onLayout?: (event: import('react-native').LayoutChangeEvent) => void;
};

export function TopBar({ flash, onCycleFlash, onPressSettings, onLayout }: Props) {
  const insets = useSafeAreaInsets();
  const FlashIcon = flash === 'off' ? ZapOff : Zap;

  return (
    <View
      onLayout={onLayout}
      className="absolute left-0 right-0 top-0 flex-row items-center justify-between bg-black px-6 pb-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <Pressable onPress={onCycleFlash} className="items-center gap-1">
        <FlashIcon color={flash === 'on' ? '#facc15' : '#fff'} size={24} />
        <Text className={flash === 'on' ? 'text-xs text-yellow-400' : 'text-xs text-white'}>
          {FLASH_LABEL[flash]}
        </Text>
      </Pressable>

      <Pressable onPress={onPressSettings} className="items-center gap-1">
        <Settings color="#fff" size={24} />
        <Text className="text-xs text-white">설정</Text>
      </Pressable>
    </View>
  );
}
