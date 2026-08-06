---
description: 노트북/Metro 없이 폰에서 단독으로 동작하는 릴리스 빌드를 만들어 실기기에 설치한다
---

"현실의 나" 카메라 앱의 릴리스(release) 빌드를 만들어 갤럭시 S25 Ultra(SM_S938N)에 설치한다.
릴리스 빌드는 JS 번들이 APK 안에 내장되어 Metro 개발 서버 없이도 독립적으로 동작한다.

## 절차

1. `adb devices -l`로 기기가 연결되어 있는지 확인한다. 연결 안 되어 있으면 사용자에게 USB로
   연결해달라고 요청하고 대기한다. 에뮬레이터가 동시에 켜져 있으면 Expo CLI가 실기기를
   에뮬레이터로 착각해 여는 버그가 있으므로, 에뮬레이터가 켜져 있다면 사용자에게 알리고 끄도록
   요청한다.
2. `npx expo run:android --device "SM_S938N" --variant release`를 실행한다
   (수 분 걸림 — minify/proguard 포함, 백그라운드로 실행하고 BUILD SUCCESSFUL/FAILED를
   기다리는 방식 권장).
   - 빌드 도중 기기 연결이 끊겨 설치가 실패하면(`adb: device ... not found`), 빌드된 APK
     (`android/app/build/outputs/apk/release/app-release.apk`)는 이미 만들어져 있으니
     사용자에게 폰 재연결을 요청한 뒤 `adb install -r <경로>`로 직접 설치한다.
3. 설치 후 `adb shell am start -n com.hyeonsiluina.app/.MainActivity`로 앱을 실행하고,
   `adb logcat -d -t 100 | grep -iE "FATAL|AndroidRuntime"`로 크래시 여부를 확인한다.
4. 화면을 스크린샷(`adb exec-out screencap -p`)으로 확인한다. 폰이 잠겨 있으면 adb로 잠금을
   풀려고 시도하지 말고 사용자에게 직접 풀어달라고 요청한다.
5. (선택, 확실히 증명하고 싶을 때) 떠 있는 Metro가 있다면 잠깐 꺼보고도 앱이 정상 실행되는지
   재확인해 "노트북 없이도 동작"을 검증할 수 있다.
6. 완료 후 결과를 요약한다 — **릴리스 빌드는 이후 코드를 수정해도 자동 반영되지 않으며,
   반영하려면 이 명령을 다시 실행해야 한다**는 점을 항상 명시한다.
