import type { Metadata } from 'next';
import AiChat from '@/components/ai-chat';

export const metadata: Metadata = {
  title: 'AutoCare AI – Asistentul tău auto',
  description: 'Discută cu AutoCare AI despre întreținere, defecțiuni și îngrijirea mașinii.',
  robots: { index: false, follow: false },
};

export default function AiPage() {
  return <AiChat />;
}
