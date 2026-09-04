import { Stack } from 'expo-router';
import { color } from '../../../src/theme.ts';

export default function EventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
