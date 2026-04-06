import React from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

export default function MessageModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info'
}: MessageModalProps) {
  if (!isOpen) return null;

  let displayMessage = message;
  try {
    // Try to parse if it's a JSON string from handleFirestoreError
    const parsed = JSON.parse(message);
    if (parsed.error) {
      displayMessage = `Lỗi hệ thống: ${parsed.error} (Thao tác: ${parsed.operationType})`;
    }
  } catch (e) {
    // Not a JSON string, use original message
  }

  const icons = {
    success: <CheckCircle className="h-6 w-6 text-emerald-500" />,
    error: <AlertCircle className="h-6 w-6 text-error" />,
    info: <Info className="h-6 w-6 text-primary" />
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-6">
      <div className="w-full max-w-sm rounded-3xl bg-surface-container-lowest p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icons[type]}
            <h3 className="font-headline text-lg font-bold text-on-surface">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full bg-surface-container-high p-2 text-on-surface-variant hover:bg-surface-container-highest transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-8 text-sm font-medium text-on-surface-variant/70 leading-relaxed">
          {displayMessage}
        </p>

        <button 
          onClick={onClose}
          className={cn(
            "w-full rounded-xl py-4 text-sm font-bold text-white shadow-lg transition-all active:scale-95",
            type === 'success' ? "bg-emerald-500 hover:bg-emerald-600" : 
            type === 'error' ? "bg-error hover:bg-error/90" : 
            "bg-primary hover:bg-primary/90"
          )}
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
