import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const BOX_SIZE = 84;

type Props = {
  point: { x: number; y: number } | null;
};

export function FocusIndicator({ point }: Props) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (point) {
      opacity.value = 1;
      opacity.value = withDelay(700, withTiming(0, { duration: 300 }));
    }
  }, [point, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!point) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: point.x - BOX_SIZE / 2,
          top: point.y - BOX_SIZE / 2,
          width: BOX_SIZE,
          height: BOX_SIZE,
          alignItems: 'center',
        },
        animatedStyle,
      ]}
    >
      <Text className="absolute -top-6 text-xs font-medium text-yellow-400">탭 포커스</Text>
      <View className="h-full w-full border-2 border-yellow-400" />
      <View className="absolute h-1.5 w-1.5 self-center rounded-full bg-yellow-400" style={{ top: BOX_SIZE / 2 - 3 }} />
    </Animated.View>
  );
}
