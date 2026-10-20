import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/store/auth';
import { ScreenSkeleton } from '../src/components/Skeleton';

export default function Index() {
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);
  const onboarded = useAuth((s) => s.onboarded);

  if (!hydrated) return <ScreenSkeleton />;
  if (!onboarded) return <Redirect href="/welcome" />;
  if (!token) return <Redirect href="/sign-in" />;
  return <Redirect href="/home" />;
}
