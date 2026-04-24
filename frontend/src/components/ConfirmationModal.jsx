import React from 'react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDangerous = false }) => {
    if (!isOpen) return null;

    const WarningIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3.05h16.94a2 2 0 001.71-3.05l-8.47-14.14a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    );

    const HelpIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
        </svg>
    );

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
        }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                }}
            />

            {/* Modal */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: 448,
                borderRadius: 16,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
                overflow: 'hidden',
            }}>
                <div style={{
                    padding: 24,
                    textAlign: 'center',
                }}>
                    {/* Icon */}
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isDangerous ? 'color-mix(in oklch, var(--color-crimson) 12%, transparent)' : 'color-mix(in oklch, var(--color-ignite) 12%, transparent)',
                        color: isDangerous ? 'var(--color-crimson)' : 'var(--color-ignite)',
                    }}>
                        {isDangerous ? <WarningIcon /> : <HelpIcon />}
                    </div>

                    {/* Title */}
                    <h3 style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: 'var(--color-fg)',
                        marginBottom: 8,
                    }}>
                        {title}
                    </h3>

                    {/* Message */}
                    <p style={{
                        fontSize: 14,
                        color: 'var(--color-fg-muted)',
                        marginBottom: 24,
                        lineHeight: 1.6,
                    }}>
                        {message}
                    </p>

                    {/* Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: 12,
                    }}>
                        <button
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                borderRadius: 12,
                                fontWeight: 600,
                                background: 'var(--color-surface-2)',
                                color: 'var(--color-fg-muted)',
                                border: '1px solid var(--color-line)',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                                fontSize: 13,
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'color-mix(in oklch, var(--color-surface-2) 110%, transparent)'}
                            onMouseLeave={(e) => e.target.style.background = 'var(--color-surface-2)'}
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                borderRadius: 12,
                                fontWeight: 700,
                                color: 'var(--color-fg)',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                                fontSize: 13,
                                background: isDangerous ? 'var(--color-crimson)' : 'var(--color-ignite)',
                                boxShadow: isDangerous
                                    ? '0 8px 16px -2px color-mix(in oklch, var(--color-crimson) 30%, transparent)'
                                    : '0 8px 16px -2px color-mix(in oklch, var(--color-ignite) 30%, transparent)',
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                            onMouseLeave={(e) => e.target.style.opacity = '1'}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
