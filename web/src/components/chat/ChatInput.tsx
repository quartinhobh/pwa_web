import React, { useState } from 'react';
import { Button } from '@/components/common/Button';

export interface ChatInputProps {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
}

/**
 * ChatInput — composes the zine Button primitive. Enter to send.
 */
export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const canSend = value.trim().length > 0 && !disabled;

  const submit = async () => {
    if (!canSend) return;
    const text = value.trim();
    setValue('');
    await onSend(text);
  };

  return (
    <form
      className="flex gap-2 items-center"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Escreva uma mensagem…"
        maxLength={500}
        className="flex-1 font-body px-3 py-2 border-4 border-zine-cream dark:border-zine-cream/30 bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 dark:placeholder:text-zine-cream/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
      />
      <Button type="submit" disabled={!canSend} aria-label="send">
        Send
      </Button>
    </form>
  );
};

export default ChatInput;
