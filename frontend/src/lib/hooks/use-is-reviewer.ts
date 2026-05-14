"use client";

import { useEffect, useMemo, useState } from "react";
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

  const [prevIsReviewer, setPrevIsReviewer] = useState(false);
  const isReviewer = useMemo(() => {
    if (!isSignedIn) return false;
    if (isReviewerByRole) return true;
    if (isLoadingOwnerSafes || isLoadingRegisteredSafes) {
      return prevIsReviewer;
    }
    if (!ownerSafes.length || !registeredSafes.length) {
      return false;
    }
    return ownerSafes.some((safe) =>
      registeredSafes.includes(safe),
    );
  }, [
    isSignedIn,
    isReviewerByRole,
    ownerSafes,
    registeredSafes,
    isLoadingOwnerSafes,
    isLoadingRegisteredSafes,
    prevIsReviewer,
  ]);

  useEffect(() => {
    setPrevIsReviewer(isReviewer);
  }, [isReviewer]);

  const isLoading = isLoadingOwnerSafes || isLoadingRegisteredSafes;

  return { isReviewer, isLoading };
}
