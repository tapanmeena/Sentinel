import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

/** Entry gate: server address, then credentials, then the dashboard. */
export default function Index() {
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const token = useAuthStore((s) => s.token);

  if (!serverUrl) return <Redirect href="/(auth)/server" />;
  if (!token) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(tabs)/live" />;
}
