import { Link } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/States';
import { Txt } from '@/components/ui/Layout';

export default function NotFoundScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <EmptyState
        icon="alertCircle"
        title="Page not found"
        message="That screen does not exist in Sentinel."
      />
      <Link href="/(tabs)/live" replace style={{ padding: 24 }}>
        <Txt variant="bodyStrong" tone="brand" align="center">
          Go to Live view
        </Txt>
      </Link>
    </Screen>
  );
}
