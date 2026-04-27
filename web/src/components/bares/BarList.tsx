import React from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import BarCard from '@/components/bares/BarCard';
import { useBarSuggestions } from '@/hooks/useBarSuggestions';

export interface BarListProps {
  idToken: string | null;
  firebaseUid: string | null;
  onRequestLogin?: () => void;
}

export const BarList: React.FC<BarListProps> = ({ idToken, firebaseUid, onRequestLogin }) => {
  const { bars, loading, error } = useBarSuggestions();

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <p className="font-body text-sm text-zine-burntOrange font-bold dark:text-zine-burntYellow">erro ao carregar bares</p>
    );
  }

  if (bars.length === 0) {
    return (
      <p className="font-body text-sm text-zine-burntOrange/70">nenhum bar indicado ainda</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {bars.map((bar) => (
        <BarCard
          key={bar.id}
          bar={bar}
          idToken={idToken}
          firebaseUid={firebaseUid}
          asDetail={false}
          onRequestLogin={onRequestLogin}
        />
      ))}
    </div>
  );
};

export default BarList;
