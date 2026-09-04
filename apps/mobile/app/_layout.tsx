import { Text, View } from 'react-native';
export default function Root() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0B' }}>
      <Text style={{ color: '#fff', fontSize: 24 }}>Pecê — metro smoke test</Text>
    </View>
  );
}
