const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Android 11+(API 30+)의 패키지 가시성 정책 때문에, 매니페스트에 <queries>로
 * 명시적으로 선언하지 않은 인텐트는 다른 앱(갤러리 등)으로 resolve되지 않는다.
 * 갤러리 버튼이 Linking.openURL(imageUri)로 사진 뷰어를 여는 데 필요하다.
 */
function withAndroidImageViewerQuery(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];

    if (!queries.intent) {
      queries.intent = [];
    }

    const alreadyDeclared = queries.intent.some(
      (intent) => intent.data?.[0]?.$?.['android:mimeType'] === 'image/*'
    );

    if (!alreadyDeclared) {
      queries.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:mimeType': 'image/*' } }],
      });
    }

    return config;
  });
}

module.exports = withAndroidImageViewerQuery;
