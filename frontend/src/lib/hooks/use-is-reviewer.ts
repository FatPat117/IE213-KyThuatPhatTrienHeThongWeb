"use client";

import { useMemo, useRef } from "react";
import { useAuth } from "@/lib/context/auth";
import { useReadReviewerSafesOnChain } from "@/lib/contracts/hooks";
import { useOwnerSafes } from "./use-owner-safes";

/**
 * Reviewer = JWT role "reviewer" (nếu có) hoặc ví sở hữu Safe trùng với danh sách reviewer on-chain.
 */
export function useIsReviewer() {
  const { token, user } = useAuth();
  const { safes: ownerSafes, isLoading: isLoadingOwnerSafes } = useOwnerSafes();
  const {
    reviewerSafes: registeredSafes,
    isLoading: isLoadingRegisteredSafes,
  } = useReadReviewerSafesOnChain();

  const isSignedIn = Boolean(token && user?.wallet);
  const roleFromAuth = (user?.role || "").toString().trim().toLowerCase();
  const isReviewerByRole = roleFromAuth === "reviewer";

  const prevIsReviewerRef = useRef(false);
  const isReviewer = useMemo(() => {
    if (!isSignedIn) return false;
    if (isReviewerByRole) return true;
    if (isLoadingOwnerSafes || isLoadingRegisteredSafes) {
      return prevIsReviewerRef.current;
    }
    if (!ownerSafes.length || !registeredSafes.length) {
      prevIsReviewerRef.current = false;
      return false;
    }
    const hasIntersection = ownerSafes.some((safe) =>
      registeredSafes.includes(safe),
    );
    prevIsReviewerRef.current = hasIntersection;
    return hasIntersection;
  }, [
    isSignedIn,
    isReviewerByRole,
    ownerSafes,
    registeredSafes,
    isLoadingOwnerSafes,
    isLoadingRegisteredSafes,
  ]);

  const isLoading = isLoadingOwnerSafes || isLoadingRegisteredSafes;

  return { isReviewer, isLoading };
}
