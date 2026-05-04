"use client";

type ErrorSource = "backend" | "wallet" | "chain" | "rpc" | "unknown";

type ErrorMessageOptions = {
    fallback?: string;
    status?: number;
};

const DEFAULT_MESSAGES: Record<ErrorSource, string> = {
    backend: "Không thể tải dữ liệu. Vui lòng thử lại.",
    wallet: "Yêu cầu ví thất bại. Vui lòng thử lại.",
    chain: "Giao dịch thất bại. Vui lòng thử lại.",
    rpc: "Lỗi kết nối mạng. Vui lòng thử lại.",
    unknown: "Đã có lỗi xảy ra. Vui lòng thử lại.",
};

function collectErrorTextParts(
    error: unknown,
    seen: Set<unknown>,
    depth: number,
): string[] {
    if (!error || depth > 6) return [];
    if (typeof error === "string") return [error];
    if (seen.has(error)) return [];
    seen.add(error);

    const parts: string[] = [];

    if (error instanceof Error && error.name) {
        parts.push(error.name);
    }

    if (typeof error === "object") {
        const o = error as Record<string, unknown>;
        for (const key of ["message", "shortMessage", "details", "reason"]) {
            const v = o[key];
            if (typeof v === "string" && v.trim()) parts.push(v);
        }
        if (o.code === 4001 || o.code === "4001") {
            parts.push("User rejected the request.");
        }
        if (typeof o.code === "string" && o.code === "ACTION_REJECTED") {
            parts.push("User rejected the request.");
        }
        if (o.cause) {
            parts.push(...collectErrorTextParts(o.cause, seen, depth + 1));
        }
        if (o.data && typeof o.data === "object") {
            parts.push(
                ...collectErrorTextParts(o.data, seen, depth + 1),
            );
        }
    }

    if (parts.length === 0) {
        return [String(error)];
    }
    return parts;
}

function extractMessage(error: unknown): string {
    if (!error) return "";
    const combined = collectErrorTextParts(error, new Set(), 0)
        .join("\n")
        .trim();
    return combined || String(error);
}

function normalizeBackendByStatus(status?: number): string | null {
    if (!status) return null;
    if (status === 401) return "Cần đăng nhập lại để tiếp tục.";
    if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
    if (status === 404) return "Không tìm thấy dữ liệu yêu cầu.";
    if (status === 409)
        return "Dữ liệu bị xung đột. Vui lòng tải lại và thử lại.";
    if (status === 422 || status === 400)
        return "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.";
    if (status === 429) return "Bạn thao tác quá nhanh. Vui lòng thử lại sau.";
    if (status >= 500) return "Hệ thống đang bận. Vui lòng thử lại sau.";
    return null;
}

function normalizeBackendByMessage(rawMessage: string): string | null {
    const message = rawMessage.toLowerCase();
    if (message.includes("not yet indexed")) {
        return "Chiến dịch đang được đồng bộ. Vui lòng thử lại sau vài giây.";
    }
    if (message.includes("only campaign creator can update metadata")) {
        return "Chỉ chủ chiến dịch mới có thể cập nhật metadata.";
    }
    if (message.includes("authentication required")) {
        return "Cần đăng nhập lại để tiếp tục.";
    }
    if (message.includes("invalid campaign id")) {
        return "Mã chiến dịch không hợp lệ.";
    }
    if (message.includes("invalid reviewersafe address")) {
        return "Địa chỉ reviewer safe không hợp lệ.";
    }
    if (message.includes("request timeout")) {
        return "Yêu cầu quá thời gian. Vui lòng thử lại.";
    }
    if (
        message.includes("rate limit") ||
        message.includes("too many requests")
    ) {
        return "Bạn thao tác quá nhanh. Vui lòng thử lại sau.";
    }
    return null;
}

function normalizeWalletOrChainMessage(rawMessage: string): string | null {
    const message = rawMessage.toLowerCase();
    if (
        message.includes("user rejected") ||
        message.includes("user denied") ||
        message.includes("rejected the request") ||
        message.includes("request rejected") ||
        message.includes("denied transaction") ||
        message.includes("userrejected") ||
        message.includes("action_rejected") ||
        message.includes("cancelled") ||
        message.includes("canceled")
    ) {
        return "Bạn đã hủy thao tác trong MetaMask.";
    }
    if (
        message.includes("not been authorized") ||
        message.includes("not authorized")
    ) {
        return "Chưa cấp quyền ví. Vui lòng kết nối và chấp nhận yêu cầu.";
    }
    if (message.includes("insufficient funds")) {
        return "Không đủ ETH để trả phí gas. Vui lòng nạp thêm ETH.";
    }
    if (message.includes("out of gas")) {
        return "Giao dịch bị thiếu gas. Vui lòng thử lại.";
    }
    if (message.includes("gas limit too high")) {
        return "Ước lượng gas vượt giới hạn block. Vui lòng thử lại.";
    }
    if (
        message.includes("wrong network") ||
        message.includes("chain id") ||
        message.includes("chain mismatch") ||
        message.includes("ensure the chain") ||
        message.includes("switch chain") ||
        message.includes("invalid chain")
    ) {
        return "Sai mạng. Vui lòng chuyển sang Sepolia trong MetaMask.";
    }
    if (message.includes("deadline not reached")) {
        return "Chưa tới hạn chiến dịch nên chưa thể thực hiện.";
    }
    if (message.includes("has reached its goal")) {
        return "Chiến dịch đã đạt mục tiêu.";
    }
    if (message.includes("reviewer not approved")) {
        return "Reviewer safe chưa được duyệt on-chain.";
    }
    if (message.includes("not active")) {
        return "Chiến dịch không còn hoạt động.";
    }
    if (message.includes("milestone not approved")) {
        return "Milestone hiện tại chưa được duyệt.";
    }
    if (message.includes("only current milestone can be disbursed")) {
        return "Chỉ có thể giải ngân milestone hiện tại.";
    }
    if (message.includes("wrong reviewer")) {
        return "Ví hiện tại không có quyền reviewer cho chiến dịch này.";
    }
    if (message.includes("network") || message.includes("rpc")) {
        return "Lỗi mạng/RPC. Vui lòng kiểm tra kết nối và thử lại.";
    }
    if (message.includes("execution reverted")) {
        return "Giao dịch bị revert. Vui lòng kiểm tra điều kiện và thử lại.";
    }
    return null;
}

function buildMessage(
    source: ErrorSource,
    error: unknown,
    options?: ErrorMessageOptions,
): string {
    const rawMessage = extractMessage(error).trim();
    const statusMessage =
        source === "backend" ? normalizeBackendByStatus(options?.status) : null;
    const messageMatch =
        source === "backend"
            ? normalizeBackendByMessage(rawMessage)
            : normalizeWalletOrChainMessage(rawMessage);

    return (
        messageMatch ||
        statusMessage ||
        options?.fallback ||
        rawMessage ||
        DEFAULT_MESSAGES[source]
    );
}

export function getBackendErrorMessage(
    error: unknown,
    options?: ErrorMessageOptions,
): string {
    return buildMessage("backend", error, options);
}

export function getWalletErrorMessage(
    error: unknown,
    options?: ErrorMessageOptions,
): string {
    return buildMessage("wallet", error, options);
}

export function getChainErrorMessage(
    error: unknown,
    options?: ErrorMessageOptions,
): string {
    return buildMessage("chain", error, options);
}

export function getRpcErrorMessage(
    error: unknown,
    options?: ErrorMessageOptions,
): string {
    return buildMessage("rpc", error, options);
}
