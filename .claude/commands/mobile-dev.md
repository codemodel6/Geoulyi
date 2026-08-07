---
description: 실기기를 Metro 개발 서버에 연결한 디버그(dev client) 빌드로 전환해, 이후 JS 코드 수정이 재빌드 없이 계속 반영되도록 만든다
---

"현실의 나" 카메라 앱을 갤럭시 S25 Ultra(SM_S938N)에서 **디버그(dev client) 빌드 + Metro**로 띄운다.
`/mobile-prod`(릴리스, 노트북 없이 단독 동작)의 반대 개념 — 이 모드는 노트북의 Metro가 계속 떠 있어야
하지만, 그 대신 JS/컴포넌트 코드를 고치면 재빌드 없이 Fast Refresh로 즉시 반영된다. 네이티브 쪽 변경
(패키지 설치, app.json 플러그인, prebuild 대상 변경)은 이 모드에서도 다시 `--variant debug`로
재실행해야 반영된다.

## 사전 지식 (이 프로젝트에서 실제로 겪은 문제들)

- **포트 8081은 이 프로젝트 전용이 아니다.** `/Users/ma26011/dev/vscode`의 다른 프로젝트(예:
  `ax-lms-lab-api`)가 상시로 8081을 점유하고 있을 수 있다 — **그 프로세스는 절대 죽이지 않는다**
  (전역 규칙: `devctl.sh`로만 관리하는 상시 서버). 8081이 이미 다른 프로젝트 것이면, 이 프로젝트의
  Metro는 **다른 포트(예: 8083)**로 띄우고 `adb reverse tcp:8081 tcp:<그 포트>`로 매핑해서 앱이
  평소처럼 `localhost:8081`로 접속해도 실제로는 그 포트의 Metro에 연결되게 한다.
- **`adb reverse` 매핑은 잘 끊긴다** — USB 케이블이 뽑혔다 다시 꽂히면 초기화되고, `npx expo
  run:android`를 다시 실행하면 그 명령이 자체적으로 기본값(`tcp:8081 tcp:8081`)으로 되돌려버린다.
  그래서 이 명령이 끝난 뒤(그리고 기기가 재연결될 때마다) 위 매핑을 다시 걸어줘야 한다.
- **CameraController(줌/포커스/노출 등 vision-camera의 controller API)는 이 디버그 빌드에서
  기기의 컨트롤러가 끝까지 생성되지 않는 문제가 실기기(SM_S938N)에서 확인된 적이 있다** — 프리뷰
  자체는 정상 표시되지만 `cameraRef.current.controller`가 계속 `undefined`로 남아 줌 같은 기능이
  네이티브까지 반영되지 않았다. 릴리스 빌드에서는 동일 코드가 정상 동작했다. 즉 **이 모드는 UI/로직
  반복 작업용으로만 신뢰하고, 카메라 컨트롤러에 의존하는 기능(줌/포커스/노출)의 최종 동작 확인은
  반드시 `/mobile-prod`로 한다.**

## 절차

1. `adb devices -l`로 기기 연결을 확인한다. 안 되어 있으면 사용자에게 USB 연결을 요청하고 대기한다.
   에뮬레이터가 동시에 켜져 있으면 Expo CLI가 실기기를 에뮬레이터로 착각해 여는 버그가 있으니, 켜져
   있다면 사용자에게 끄도록 요청한다.
2. `lsof -iTCP:8081 -sTCP:LISTEN`으로 8081이 이미 다른 프로세스(다른 프로젝트의 상시 서버) 차지인지
   확인한다.
   - 비어 있으면: 이 프로젝트의 Metro를 기본 포트 8081로 띄운다 (`adb reverse` 별도 조정 불필요).
   - 이미 차지되어 있으면: 8083 등 비어 있는 다른 포트를 골라 그 포트로 띄우고, 아래 5번에서
     `adb reverse tcp:8081 tcp:<그 포트>`를 반드시 걸어준다.
3. 이미 이 프로젝트의 Metro가 떠 있는지 확인한다(예: `lsof` 결과나 이전에 남겨둔 로그 파일). 떠 있으면
   새로 띄우지 말고 재사용한다.
4. `npx expo run:android --device "SM_S938N" --variant debug`를 백그라운드로 실행해 디버그 APK를
   빌드·설치한다. 이 명령이 끝나면 자체적으로 Metro를 `Waiting on http://localhost:8081`로만
   출력하고 실제 서버는 안 띄운 채 종료되는 경우가 있다 — 그래서 별도로 Metro를 직접 띄운다.
5. Metro가 아직 안 떠 있으면 `npx expo start --dev-client [--port <포트>]`를 백그라운드로 띄운다.
   `adb reverse --list`로 현재 매핑을 확인하고, 8081이 아닌 포트를 썼다면
   `adb reverse tcp:8081 tcp:<그 포트>`를 걸어준다.
6. `adb shell am force-stop com.hyeonsiluina.app` 후 `adb shell am start -n
   com.hyeonsiluina.app/.MainActivity`로 앱을 재시작해 최신 JS 번들을 확실히 받아오게 한다.
7. Metro 로그에서 `Android Bundled ... index.ts`가 찍히는지, `ERROR`/`Unhandled` 등이 없는지
   확인한다. `adb logcat -d -t 100 | grep -iE "FATAL|AndroidRuntime"`로 네이티브 크래시도 확인한다.
8. 화면을 스크린샷(`adb exec-out screencap -p`)으로 확인한다. 폰이 잠겨 있으면 adb로 풀려고 하지
   말고 사용자에게 직접 풀어달라고 요청한다.
9. 완료 후 결과를 요약한다 — **이후 JS/컴포넌트 코드를 고치면 Metro가 켜져 있는 한 재빌드 없이
   자동 반영된다(Fast Refresh)**는 점과, **카메라 컨트롤러 관련 기능은 이 모드에서 신뢰할 수 없으니
   `/mobile-prod`로 최종 확인이 필요하다**는 점을 항상 명시한다.
