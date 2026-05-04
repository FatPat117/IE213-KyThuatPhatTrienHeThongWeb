const DEFAULT_GRACE_PERIOD_DAYS = Number(
    process.env.MILESTONE_GRACE_PERIOD_DAYS || 0,
);

function calculateDeadline(
    targetDate,
    gracePeriodDays = DEFAULT_GRACE_PERIOD_DAYS,
) {
    const date = new Date(targetDate);
    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid targetDate");
    }

    const deadline = new Date(date);
    deadline.setUTCDate(deadline.getUTCDate() + Number(gracePeriodDays || 0));
    return deadline;
}

function isDeadlineExceeded(
    targetDate,
    gracePeriodDays = DEFAULT_GRACE_PERIOD_DAYS,
    now = new Date(),
) {
    const deadline = calculateDeadline(targetDate, gracePeriodDays);
    return now.getTime() >= deadline.getTime();
}

function getTimeRemaining(
    targetDate,
    gracePeriodDays = DEFAULT_GRACE_PERIOD_DAYS,
    now = new Date(),
) {
    const deadline = calculateDeadline(targetDate, gracePeriodDays);
    const remainingMs = deadline.getTime() - now.getTime();

    if (remainingMs <= 0) {
        return {
            deadline,
            isExpired: true,
            ms: 0,
            days: 0,
            hours: 0,
            minutes: 0,
        };
    }

    const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor(
        (remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
    );
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

    return {
        deadline,
        isExpired: false,
        ms: remainingMs,
        days,
        hours,
        minutes,
    };
}

module.exports = {
    DEFAULT_GRACE_PERIOD_DAYS,
    calculateDeadline,
    isDeadlineExceeded,
    getTimeRemaining,
};
