import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

type Props = {
  onClose: () => void;
};

export function SettingsScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-6" style={{ paddingTop: insets.top + 12 }}>
        <Text className="text-lg font-semibold text-white">설정</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X color="#fff" size={24} />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center">
        <Text className="text-white/60">설정 화면은 준비 중입니다.</Text>
      </View>
    </View>
  );
}
