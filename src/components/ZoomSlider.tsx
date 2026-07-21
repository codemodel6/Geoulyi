import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';

const APPLY_INTERVAL_MS = 80;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

type Props = {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onChange: (zoom: number) => void;
};

export function ZoomSlider({ zoom, minZoom, maxZoom, onChange }: Props) {
  const trackWidthShared = useSharedValue(0);
  const dragRatio = useSharedValue<number | null>(null);
  const lastAppliedAt = useSharedValue(0);
  const range = maxZoom - minZoom || 1;

  const applyZoom = (ratio: number) => {
    onChange(minZoom + ratio * range);
  };

  const updateFromEvent = (x: number, force: boolean) => {
    'worklet';
    if (trackWidthShared.value <= 0) return;
    const ratio = clamp(x / trackWidthShared.value, 0, 1);
    dragRatio.value = ratio;
    const now = Date.now();
    if (force || now - lastAppliedAt.value > APPLY_INTERVAL_MS) {
      lastAppliedAt.value = now;
      runOnJS(applyZoom)(ratio);
    }
  };

  const pan = Gesture.Pan()
    .onBegin((event) => {
      updateFromEvent(event.x, true);
    })
    .onUpdate((event) => {
      updateFromEvent(event.x, false);
    })
    .onFinalize((event) => {
      updateFromEvent(event.x, true);
      dragRatio.value = null;
    });

  const staticProgress = clamp((zoom - minZoom) / range, 0, 1);

  const progress = useDerivedValue(() => (dragRatio.value === null ? staticProgress : dragRatio.value));

  const pillStyle = useAnimatedStyle(() => ({
    left: `${progress.value * 100}%`,
  }));

  const midZoom = (minZoom + maxZoom) / 2;

  return (
    <View className="px-8 pb-2">
      <View className="mb-1 flex-row items-center">
        <Animated.View style={[{ position: 'absolute', transform: [{ translateX: -22 }] }, pillStyle]}>
          <View className="rounded-full border border-yellow-400 bg-black/70 px-3 py-1">
            <Text className="text-xs font-semibold text-yellow-400">{zoom.toFixed(1)}x</Text>
          </View>
        </Animated.View>
      </View>

      <GestureDetector gesture={pan}>
        <View
          className="h-8 justify-center"
          onLayout={(e) => {
            trackWidthShared.value = e.nativeEvent.layout.width;
          }}
        >
          <View className="h-[1px] w-full bg-white/30" />
          <View className="absolute w-full flex-row justify-between px-[2px]">
            {Array.from({ length: 21 }).map((_, i) => (
              <View key={i} className="h-2 w-[1px] bg-white/30" />
            ))}
          </View>
        </View>
      </GestureDetector>

      <View className="mt-1 flex-row justify-between">
        <Text className="text-xs text-white/70">{minZoom.toFixed(1)}x</Text>
        <Text className="text-xs text-white/70">{midZoom.toFixed(1)}x</Text>
        <Text className="text-xs text-white/70">{maxZoom.toFixed(1)}x</Text>
      </View>
    </View>
  );
}
