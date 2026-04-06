import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  requiresInput?: string;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  variant = 'primary',
  requiresInput
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = React.useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requiresInput && inputValue.trim().toUpperCase() !== requiresInput.toUpperCase()) return;
    onConfirm();
    onClose();
    setInputValue('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-6">
      <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {variant === 'danger' && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}
            <h3 className="font-headline text-xl font-bold text-on-surface">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full bg-surface-container-high p-2 text-on-surface-variant hover:bg-surface-container-highest transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-8 text-sm font-medium text-on-surface-variant/70 leading-relaxed">
          {message}
        </p>

        {requiresInput && (
          <div className="mb-8 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
              Nhập "{requiresInput}" để xác nhận
            </label>
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full rounded-xl border-none bg-surface-container-low p-4 text-sm font-medium focus:ring-2 focus:ring-error"
              placeholder={requiresInput}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 rounded-xl bg-surface-container-high py-4 text-sm font-bold text-on-surface transition-all hover:bg-surface-container-highest"
          >
            {cancelText}
          </button>
          <button 
            onClick={handleConfirm}
            disabled={requiresInput ? inputValue !== requiresInput : false}
            className={cn(
              "flex-[2] rounded-xl py-4 text-sm font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:scale-100",
              variant === 'danger' ? "bg-error hover:bg-error/90" : "bg-primary hover:bg-primary/90"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
