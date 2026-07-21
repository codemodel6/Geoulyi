@AGENTS.md

# 프로젝트: "현실의 나" (Hyeonsilui-Na) 카메라 앱

- 앱 표시 이름(사용자에게 보이는 이름): 현실의 나
- 영문 이름 / 프로젝트 폴더: Hyeonsilui-Na
- 번들 ID(iOS bundleIdentifier / Android package): `com.hyeonsiluina.app`
- 타깃 플랫폼: **Android 우선** (이 Mac에 iOS 전체 Xcode.app이 없어 iOS는 추후 별도 진행)

## 컨셉
셀카(전면 카메라)는 좌우가 반전된 "거울 속 나"를 보여준다. 이 앱은 그 반전을
되돌려 "남들이 실제로 보는, 현실의 나"를 보여주는 카메라 앱이다.
프리뷰와 저장되는 사진 모두에 좌우 반전을 적용/해제할 수 있어야 한다.

**좌우반전 기본값은 `false`(반전 안 됨 = "현실의 나" 그대로)다.** 최초 기획 문서엔 기본 ON(거울 모드)으로 적혀 있었으나, 실기기 테스트 후 사용자가 명시적으로 기본 OFF로 바꿔달라고 요청해 변경됨 — 이 앱의 이름/컨셉("현실의 나")과도 더 맞는 방향.

## 개발 방식
- Expo 기반, 카메라는 네이티브 모듈이 필요하므로 **Expo Prebuild + Development Build(dev client)** 방식.
- Expo Go로는 동작하지 않음. `npx expo prebuild` 후 `npx expo run:android` / `npx expo run:ios`로 테스트.
- 네이티브 권한 등은 Expo config plugin과 app.json으로 처리 (ios/android 폴더는 직접 수정하지 않음 — `.gitignore`에서도 제외됨, prebuild로 재생성).

## 기술 스택 (버전은 2026-07-21 기준 설치된 값)
- Expo SDK 57 (`expo@~57.0.7`), React Native 0.86, React 19.2, TypeScript
- NativeWind v4 (`nativewind@^4.2.6`) + Tailwind CSS **v3.4.x로 고정** (NativeWind 공식 설치 가이드가 v3.4.17 기준으로 검증되어 있어, 최신 Tailwind v4 대신 이 버전으로 고정함 — 설정 드리프트 회피)
- react-native-vision-camera **v5** (`^5.1.1`) — v4와 완전히 다른 세션/아웃풋 기반 API(Nitro Modules). 아래 "vision-camera v5 API 메모" 참고
- react-native-reanimated, react-native-gesture-handler — 줌/노출/포커스 제스처
- expo-image-manipulator — 촬영 후 이미지 좌우 반전(horizontal flip) 처리
- expo-media-library — SDK 57부터 **새 API(Query/Asset/Album 클래스, `expo-media-library`)가 기본**이고, 예전 `createAssetAsync`/`getAssetsAsync` 스타일 API는 `expo-media-library/legacy`로 이동함
- lucide-react-native — 아이콘

## vision-camera v5 API 메모 (v4 지식으로 추측하면 틀림 — node_modules의 .d.ts를 직접 확인할 것)
- 단일 `camera.takePhoto()` 방식이 아니라, `usePhotoOutput()` 훅으로 만든 `CameraPhotoOutput`을 `<Camera outputs={[photoOutput]}>`에 연결하고 `photoOutput.capturePhotoToFile({flashMode}, {})`로 촬영 → `{filePath}` 반환(파일시스템 경로, `file://` 아님 — 직접 prefix 붙여야 함).
- `<Camera>`에 `mirrorMode` prop이 있어 네이티브 레벨로 미러링을 걸 수도 있지만, **이 프로젝트는 프리뷰 컨테이너에 CSS `transform: scaleX(-1)`를 적용하는 방식으로 미러링을 구현**하므로 `<Camera mirrorMode="off">`로 고정하고, 촬영된 파일은 `mirrored===true`일 때만 `expo-image-manipulator`로 수동 flip 후 저장한다 (스펙에 명시된 방식 그대로 유지).
- 탭포커스는 `cameraRef.current.focusTo({x, y}, options)` (뷰 좌표계, 0~1 정규화 아님).
- 줌은 **prop으로 넘기지 않는다.** `<Camera zoom={}>`처럼 선언적으로 넘기면 vision-camera 내부 effect가 값이 바뀔 때마다 `controller.setZoom`(비동기 코루틴)을 호출하는데, 겹쳐 호출되면 이전 호출이 계속 취소되며 uncaught rejection이 쌓인다(아래 버그 노트 참고). 대신 `cameraRef.current.controller.setZoom(value)`를 **직접, 한 번에 하나씩만 진행되도록 큐잉해서** 호출한다 (`useCameraController.ts`의 `createSerializedApplier` 참고).
- 디바이스 zoom 범위: `device.minZoom/maxZoom` — 기기마다 실제 범위가 다르다(예: 갤럭시 S25 Ultra 전면 카메라는 1.0x~8.0x였음, 처음 기획에서 가정한 0.5x~2.0x가 아니었음). **줌 슬라이더의 트랙 범위·눈금 라벨은 반드시 `device.minZoom/maxZoom`을 그대로 써야 한다** — 고정된 숫자(0.5~2.0)를 슬라이더 표시 범위로 쓰면 실제 기기 범위와 안 맞아 드래그해도 그 구간만 클램프되어 사실상 안 움직이는 것처럼 보인다(과거 실제 버그였음).
- 노출(exposure) 조절 기능은 사용자 요청으로 **완전히 제거됨** (밝기 슬라이더 없음). `BrightnessSlider.tsx` 삭제됨, 훅에 exposure 관련 상태/로직 없음.
- **Android에서 `<Camera>`의 프리뷰 서피스 기본값(`implementationMode`)은 `'performance'`(SurfaceView)인데, 이 모드는 RN의 View transform(우리가 쓰는 좌우반전 `scaleX(-1)`)을 반영하지 않는다.** 반드시 `implementationMode="compatible"`(TextureView)로 설정해야 CSS 미러링이 실제로 화면에 적용된다 — 이거 빠뜨리면 반전 버튼을 눌러도 상태(하이라이트)만 바뀌고 프리뷰는 전혀 안 뒤집힌다.

## 화면 레이아웃 / 로직
- `src/screens/CameraScreen.tsx`가 메인 화면이며 아래 구조를 그대로 따른다:
  - TopBar(플래시 자동→켜기→끄기 순환, 설정 버튼) — `src/components/TopBar.tsx`
  - 카메라 프리뷰 전체 화면, 기본 상태 = 좌우 반전 **안 됨**(`mirrored` 기본 `false` — 위 컨셉 항목 참고)
  - 밝기 조절 없음 (사용자 요청으로 제거됨)
  - 하단 가로 줌 슬라이더(디바이스 실제 minZoom~maxZoom 범위, 3분할 눈금 라벨) — `src/components/ZoomSlider.tsx`
  - 하단 5버튼 바(좌→우: 갤러리 / 타이머 / 사진 찍기 / 좌우 반전(사람 아이콘) / 전면·후면 전환), 텍스트 라벨 없이 아이콘만, `justify-evenly`로 자연스러운 크기 기준 균등 배치 — `src/components/BottomBar.tsx`
    - 좌우반전 버튼의 색 반전 스타일은 **"켜짐" 상태일 때 흰 테두리+투명 배경(`INACTIVE_CIRCLE`), "꺼짐"(기본) 상태일 때 검정 테두리+흰 배경(`ACTIVE_CIRCLE`)이다** — 직관적으로는 반대로 보일 수 있지만 사용자가 실기기로 직접 확인하고 이 방향으로 확정한 것이니 임의로 되돌리지 말 것.
    - 타이머 버튼은 켜짐/꺼짐 상관없이 항상 `INACTIVE_CIRCLE`(검정 배경+흰 테두리) 스타일이고, 활성화 시(3/10)에는 아이콘 대신 원 안에 흰색 숫자를 굵게 표시 — 갤러리/전환 버튼과 같은 중립 스타일로 통일, 배경색으로 강조하지 않음.
  - 탭포커스 인디케이터 — `src/components/FocusIndicator.tsx`
  - 타이머 카운트다운 오버레이 — `src/components/TimerCountdown.tsx`
  - 설정 화면은 placeholder, `Modal`로 표시 — `src/screens/SettingsScreen.tsx`
- 카메라 상태/로직은 전부 `src/hooks/useCameraController.ts`에 집중 (flash/mirrored/facing/zoom/timer/lastPhotoUri/capturePhoto/focusAt).
- 갤러리 버튼은 별도 이미지피커 라이브러리 없이 `Linking.openURL(lastPhotoUri)`로 최근 촬영 사진을 시스템 갤러리 앱에서 열도록 구현(기술 스택에 이미지피커가 없어 이 방식을 택함). `lastPhotoUri`는 `asset.id`(Android에서 `content://` URI)를 써야 함 — 아래 버그 노트 참고.

## 검증 환경
- 이 Mac은 실물 Android 기기가 없어 **AVD(Pixel_8_API_36, Android 16 / API 36, google_apis arm64-v8a)로만 검증** 가능.
- AVD는 기본적으로 전면 카메라가 꺼져 있어(`hw.camera.front=none`) `~/.android/avd/Pixel_8_API_36.avd/config.ini`에서 `hw.camera.front=emulated`로 수정해둠.
- AVD는 기본 `hw.gpu.enabled=no`(소프트웨어 렌더링)였는데, 이 상태에서는 vision-camera의 카메라 프리뷰 서피스와 RN 뷰가 겹치며 화면 상단에 이전 프레임 텍스트가 잔상처럼 남는 렌더링 아티팩트가 있었음 → `hw.gpu.enabled=yes` + `emulator ... -gpu swiftshader_indirect`로 기동해 대부분 해소(아주 옅은 잔상은 남을 수 있음, UI 계층 덤프로 실제 컴포넌트 중복이 아님을 확인함 — 앱 버그 아니라 에뮬레이터 렌더링 한계).
- 에뮬레이터 가상 카메라는 합성 패턴만 보여주고 실제 줌/노출/포커스 광학 동작은 검증 불가 — 이 부분은 실기기 확보 후 별도 확인 필요.
- Android 툴체인: Homebrew로 설치 (`watchman`, `openjdk@17` — zulu@17 캐스크는 sudo 설치가 필요해 대신 사용, `android-commandlinetools`). `~/.zshrc`에 `JAVA_HOME`/`ANDROID_HOME`/`PATH` 등록됨.
- **Mac 웹캠을 전면 카메라로 연결해서 실제 화면으로 테스트 가능**: `emulator -webcam-list`로 웹캠 이름 확인 후 `~/.android/avd/Pixel_8_API_36.avd/config.ini`의 `hw.camera.front=webcam0`으로 설정하면 됨(에뮬레이터 재시작 필요). 이 웹캠 패스스루는 자체적으로 화면을 한 번 좌우 반전해서 넘겨주므로, 에뮬레이터에서 `mirrored` 상태를 토글했을 때 보이는 방향이 실기기와 반대일 수 있음 — 실기기(아래 참고)에서 최종 확인함.
- **실물 갤럭시 S25 Ultra(SM_S938N)로 검증 완료.** USB로 연결해 `npx expo run:android --device <모델명>`으로 설치. 에뮬레이터와 실기기에 동시에 연결되어 있으면 Expo CLI가 실기기를 에뮬레이터로 착각해 여는 버그가 있었음(`emulator @SM_S938N` 시도 후 실패) — 에뮬레이터를 끄고 실기기 하나만 연결된 상태에서 `--device <정확한 모델명>`을 주면 해결됨. adb 시리얼(예: R3CY4003PHL)이 아니라 `adb devices -l`에 나오는 `model:` 값을 써야 함.

## 디버깅 중 발견한 실제 버그와 수정 (다음에 비슷한 코드 건드릴 때 참고)
- **카메라 세션 시작 전 zoom/exposure 적용 → 크래시성 에러**: `<Camera zoom={} exposure={}>`를 마운트 즉시 값과 함께 넘기면 CameraX 세션이 아직 활성화되기 전이라 `CameraControl$OperationCanceledException: Camera is not active`가 uncaught promise rejection으로 터짐. `onStarted`/`onStopped` 콜백으로 `cameraReady` 상태를 두고 대응(현재는 아래 항목 때문에 prop 자체를 안 씀).
- **[실기기에서 재현된 진짜 버그] 슬라이더를 빠르게 드래그하면 노출/줌 API 취소 에러가 수십 개씩 쌓임**: 처음엔 슬라이더 쪽에서 80ms throttle만 걸었는데 에뮬레이터에서는 괜찮아 보였지만, **실물 갤럭시에서 테스트하니 11초 드래그에 71개의 `Cancelled due to another zoom value being set` uncaught rejection이 발생**했다 — 스로틀은 호출 "빈도"만 줄일 뿐, 이전 호출이 새 호출보다 오래 걸리면 여전히 겹친다. 근본 수정: `<Camera zoom={} exposure={}>` prop을 아예 안 쓰고, `useCameraController.ts`의 `createSerializedApplier`로 `cameraRef.current.controller.setZoom/setExposureBias`를 **직접 호출하되 항상 최대 1개만 진행 중이도록 큐잉**(진행 중이면 최신 값만 pending에 저장, 끝나면 이어서 적용)하고 실패는 `.catch(()=>{})`로 우리가 직접 삼킴. 이후 동일한 강도로 재현 테스트해도 uncaught 에러 0개로 확인됨.
- **[실기기에서만 드러난 진짜 버그] 좌우반전 토글이 프리뷰에 전혀 반영 안 됨**: 버튼 상태(하이라이트)는 바뀌는데 실제 화면은 반전 전/후 스크린샷이 픽셀 단위로 동일했음. 원인은 Android `<Camera>`의 기본 `implementationMode`가 `'performance'`(SurfaceView)라서 RN View의 `transform: scaleX(-1)`을 반영하지 않기 때문 — `implementationMode="compatible"`(TextureView)로 바꿔서 해결. 에뮬레이터 웹캠 테스트에서는 우연히 다른 렌더링 경로였는지 이 문제가 안 보였어서, **이 버그는 반드시 실기기에서만 잡힌다는 점 유의**.
- **[실기기에서만 드러난 진짜 버그] 갤러리 버튼이 아무 반응 없음**: `expo-media-library`의 `Asset.getUri()`는 Android에서 `file://` 경로를 반환하는데, Android 7+는 `file://` URI를 다른 앱에 그대로 노출하면 `FileUriExposedException`을 던진다(우리 코드가 `.catch(()=>{})`로 조용히 무시하고 있어서 증상만 "아무 일도 안 일어남"으로 보였음). `Asset.id`는 Android에서 이미 `content://media/...` 형태라 안전하게 쓸 수 있음 — `getUri()` 대신 `asset.id`를 `lastPhotoUri`로 사용하도록 수정. 추가로 Android 11+ 패키지 가시성 때문에 `<queries>`에 `image/*` VIEW 인텐트를 선언해야 함 → `plugins/withAndroidImageViewerQuery.js` config plugin으로 추가(app.json 순수 JSON이라 인라인 플러그인 불가 → 로컬 plugin 파일 + app.json에서 경로로 참조).
- **[실기기에서만 드러난 진짜 버그] 앱을 홈으로 보냈다가 다시 열면 "Camera is disabled probably due to a device policy" 에러**: `<Camera isActive>`를 앱의 포그라운드/백그라운드 상태와 무관하게 항상 `true`로 고정해뒀던 게 원인 — 백그라운드에서도 카메라 세션을 계속 붙잡고 있으면 OS가 이를 제지하면서 재진입 시 세션 재개에 실패함. `react-native`의 `AppState`를 구독해 앱이 `'active'`일 때만 `isActive`를 true로 주도록 수정(`useCameraController.ts`의 `isAppActive`). 홈↔앱 전환 3회 반복 재현 테스트에서 에러 0건으로 확인됨.
- **expo-media-library 권한 요청이 기본으로 photo+video+audio를 전부 요청**: 카메라 앱인데 "음악 및 오디오 접근 허용" 다이얼로그까지 떠서, JS 쪽 `getPermissionsAsync`/`requestPermissionsAsync` 호출에 `['photo']`만 넘기는 것과 별개로, **app.json의 `expo-media-library` config plugin에도 `granularPermissions: ["photo"]`를 넣어야 AndroidManifest.xml에 `READ_MEDIA_AUDIO` 자체가 안 들어가고 다이얼로그도 안 뜬다** (JS 쪽만 고치면 매니페스트에는 여전히 선언되어 있어서 재현될 수 있음 — 반드시 `expo prebuild --clean` 재실행 필요).
- **[실기기에서만 드러난 진짜 버그] 줌 슬라이더 눈금(0.5x/1.0x/2.0x)이 고정값이라 실제 동작과 안 맞음**: 갤럭시 S25 Ultra 전면 카메라의 실제 줌 범위는 1.0x~8.0x였는데 슬라이더는 하드코딩된 0.5~2.0 표시 범위 안에서만 값을 클램프해 보내고 있어서, 사실상 드래그해도 카메라 줌이 거의 안 바뀌는 것처럼 보였음. `ZoomSlider.tsx`의 표시 범위·눈금 라벨을 `minZoom`/`maxZoom` prop(디바이스 실측값) 기준으로 직접 계산하도록 수정.
- **[실기기에서만 드러난 진짜 버그] 저장된 사진에 상단바/하단바에 해당하는 영역까지 찍혀 나옴**: `photoOutput.capturePhotoToFile()`은 화면(RN 뷰) 레이아웃과 무관하게 카메라 센서의 기본 촬영 비율(갤럭시 S25 Ultra 전면 카메라는 4000x3000, 4:3)로 저장한다. 근본 수정: 촬영 후 `expo-image-manipulator`로 화면에 실제로 보이는 미리보기 비율에 맞춰 중앙 크롭(`useCameraController.ts`의 `computeCoverCrop`, 미리보기 기본 resizeMode인 'cover'와 동일한 방식)한 뒤 저장한다. 크롭 후 재인코딩 시 `compress` 값을 안 주면 파일 용량이 원본의 2배 이상으로 커지므로 `saveAsync({ format: SaveFormat.JPEG, compress: 0.92 })`처럼 명시할 것.
  - **주의**: 처음엔 `<Camera>`를 상단바/하단바 "사이"에만 배치하도록 `CameraScreen.tsx` 레이아웃 자체를 절대좌표 오버레이 → flex column 구조로 바꿨었는데, 이게 실기기에서 화면이 이상해지는 부작용을 일으켜서 **레이아웃은 원래의 절대좌표 오버레이 방식(Camera가 화면 전체를 차지하고 TopBar/하단 영역이 그 위에 불투명하게 덮이는 구조)으로 되돌렸다.** 대신 `TopBar`와 하단(줌 슬라이더+BottomBar) 컨테이너 각각에 `onLayout`을 달아 실제 높이를 측정하고, `화면 높이 - 상단바 높이 - 하단 영역 높이`로 "실제 보이는 미리보기 영역"의 비율을 계산해서 `setPreviewSize`에 넘긴다(`CameraScreen.tsx` 참고) — 카메라 뷰 자체의 레이아웃 구조는 건드리지 않고 크롭 비율 계산만 하는 더 안전한 방식.
- **한국(그리고 일본) 판매 안드로이드 기기는 촬영 셔터음을 앱에서 끌 수 없다.** `capturePhotoToFile`에 `enableShutterSound: false`를 넘겨도 무시된다 — 몰카 방지 규제로 제조사가 강제해둔 것이라 앱 코드로 우회 불가능한 것으로 확인됨(실기기 재현 테스트로 확인, 코드 문제 아님).
- 촬영 시 셔터음은 `capturePhotoToFile({ ..., enableShutterSound: false }, {})`로 끔(기본값 true).
- Android 14+에서 사용자가 "이 사진들만 선택"으로 부분 접근만 허용하면 하단에 흰색 "제한된 사진 접근" 안내 배너가 뜨는 건 OS 표준 동작이며 앱 버그 아님.
- 개발 모드에서 보이는 `[Worklets] Tried to modify key 'current' of an object...` 경고는 vision-camera `<Camera>` 내부의 reanimated 연동에서 나오는 것으로 보이며 기능상 문제는 없음(release 빌드엔 안 나옴) — `App.tsx`에서 `LogBox.ignoreLogs([/\[Worklets\] Tried to modify key/])`로 숨겨둠.
