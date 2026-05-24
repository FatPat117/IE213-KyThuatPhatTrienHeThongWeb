type LoadingSpinnerProps = {
    size?: "sm" | "md" | "lg";
    className?: string;
    label?: string;
};

const sizeClasses = {
    sm: "h-5 w-5 border-2",
    md: "h-10 w-10 border-2",
    lg: "h-14 w-14 border-[3px]",
} as const;

export function LoadingSpinner({
    size = "md",
    className = "",
    label,
}: LoadingSpinnerProps) {
    return (
        <div
            className={`inline-flex flex-col items-center gap-3 ${className}`}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <span
                className={`loading-spinner animate-spin rounded-full border-[var(--accent-cyan)] border-t-transparent ${sizeClasses[size]}`}
                aria-hidden
            />
            {label ? (
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                    {label}
                </span>
            ) : null}
            <span className="sr-only">{label ?? "Đang tải"}</span>
        </div>
    );
}

type PageLoadingProps = {
    label?: string;
    className?: string;
    minHeight?: string;
};

export function PageLoading({
    label = "Đang tải dữ liệu...",
    className = "",
    minHeight = "min-h-[40vh]",
}: PageLoadingProps) {
    return (
        <div
            className={`page-loading flex w-full flex-col items-center justify-center px-6 py-16 ${minHeight} ${className}`}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <LoadingSpinner size="lg" label={label} />
        </div>
    );
}

type InlineLoadingProps = {
    label?: string;
    className?: string;
};

export function InlineLoading({
    label = "Đang tải...",
    className = "",
}: InlineLoadingProps) {
    return (
        <div className={`inline-loading flex items-center gap-2 ${className}`}>
            <span
                className="loading-spinner h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-cyan)] border-t-transparent"
                aria-hidden
            />
            <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        </div>
    );
}
