import { View, Text } from 'react-native';

type Props = {
  count: number | null;
};

export function TimerCountdown({ count }: Props) {
  if (count === null) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 items-center justify-center bg-black/40"
    >
      <Text className="text-9xl font-bold text-white">{count}</Text>
    </View>
  );
}
