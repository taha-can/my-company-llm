"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import {
  SlashCommandMenu,
  type SlashCommand,
} from "@/components/chat/SlashCommandMenu";
import type { AgentDefinition } from "@/lib/api";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  agents?: AgentDefinition[];
}

export function ChatInput({
  onSend,
  disabled,
  placeholder,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const slashFilter = value.startsWith("/") ? value.split(/\s/)[0] : "";

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    setShowCommands(false);
    textareaRef.current?.focus();
  }, [value, onSend]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setValue(newVal);

    if (newVal.startsWith("/") && !newVal.includes(" ")) {
      setShowCommands(true);
    } else if (!newVal.startsWith("/")) {
      setShowCommands(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showCommands) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, showCommands]
  );

  const handleCommandSelect = useCallback((cmd: SlashCommand) => {
    if (cmd.suffix) {
      setValue(cmd.command + cmd.suffix);
      setShowCommands(false);
      textareaRef.current?.focus();
    } else {
      setValue("");
      setShowCommands(false);
      onSend(cmd.command);
      textareaRef.current?.focus();
    }
  }, [onSend]);

  return (
    <div className="relative border-t border-border bg-card p-3">
      <SlashCommandMenu
        filter={slashFilter}
        onSelect={handleCommandSelect}
        onClose={() => setShowCommands(false)}
        visible={showCommands}
      />
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Type your directive..."}
          disabled={disabled}
          className="min-h-[40px] max-h-[140px] resize-none text-sm"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          size="icon"
          className="shrink-0 h-9 w-9"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
