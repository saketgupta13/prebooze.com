import { Pressable, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import { colors } from '../theme/tokens';

export default function FavoriteHeart({ active, onToggle, style }: { active: boolean; onToggle: () => void; style?: object }) {
  return (
    <Pressable style={[styles.btn, style]} onPress={onToggle} hitSlop={8}>
      <Heart size={15} color={active ? colors.accent : '#fff'} fill={active ? colors.accent : 'transparent'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(20,21,15,0.55)', alignItems: 'center', justifyContent: 'center',
  },
});
