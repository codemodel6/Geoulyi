import { useEffect, useState } from 'react';
import { Dimensions, FlatList, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Album, AssetField, MediaType, Query, type Asset } from 'expo-media-library';

type Props = {
  onClose: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
// Screenshots 앨범이 비정상적으로 커진 경우를 대비한 방어적 상한 — 일반적인 사용 범위를 넘는 경우는 없다.
const MAX_ASSETS = 300;

export function GalleryViewerScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    (async () => {
      const album = await Album.get('Screenshots');
      if (!album) return;
      const result = await new Query()
        .album(album)
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .limit(MAX_ASSETS)
        .exe();
      setAssets(result);
    })();
  }, []);

  return (
    <View className="flex-1 bg-black">
      <View
        className="flex-row items-center justify-between px-6"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Text className="text-lg font-semibold text-white">갤러리</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X color="#fff" size={24} />
        </Pressable>
      </View>

      {assets.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-white/60">저장된 스크린샷이 없습니다.</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
              <Image source={{ uri: item.id }} style={{ flex: 1 }} resizeMode="contain" />
            </View>
          )}
        />
      )}
    </View>
  );
}
