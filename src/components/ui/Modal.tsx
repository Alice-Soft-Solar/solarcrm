import { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string | ReactNode;
  type?: 'confirm' | 'alert' | 'success' | 'error';
  confirmText?: string;
  cancelText?: string;
}

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'alert',
  confirmText = 'OK',
  cancelText = 'Cancel',
}: ModalProps) {
  if (!isOpen) return null;

  const isConfirm = type === 'confirm';
  const isSuccess = type === 'success';
  const isError = type === 'error';

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Icon */}
        <div className="flex items-center justify-center mb-4">
          {isSuccess && (
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {isError && (
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          {isConfirm && (
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-foreground text-center mb-2">
          {title}
        </h3>

        {/* Message */}
        <div className="text-sm text-foreground opacity-70 text-center mb-6">
          {message}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {isConfirm && (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-zinc-300 rounded-md text-foreground hover:bg-zinc-50 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                {confirmText}
              </button>
            </>
          )}
          {!isConfirm && (
            <button
              onClick={onClose}
              className={`w-full px-4 py-2 rounded-md text-white transition-colors ${
                isSuccess
                  ? 'bg-green-600 hover:bg-green-700'
                  : isError
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
