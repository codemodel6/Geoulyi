import './global.css';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CameraScreen } from './src/screens/CameraScreen';

// vision-camera의 <Camera> 내부 reanimated 연동에서 나오는 무해한 경고 (개발 모드에서만 표시됨)
LogBox.ignoreLogs([/\[Worklets\] Tried to modify key/]);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar hidden />
        <CameraScreen />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
