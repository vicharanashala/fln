/**
 * AnswerKeyPanel — embeds the Answer Key Generator feature inside the
 * main FLN dashboard (Layout.tsx based, view-state system).
 *
 * Manages its own sub-navigation: list view ↔ review/edit view.
 */
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import AssessmentsListPage from "./AssessmentsListPage";
import TemplateReviewPage from "./TemplateReviewPage";

// Isolated QueryClient for this panel so it doesn't conflict
const panelQueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

interface AnswerKeyPanelProps {
  token: string;
}

export default function AnswerKeyPanel({ token: _token }: AnswerKeyPanelProps) {
  // Sub-navigation: null = list view, string = review view for that assessment ID
  const [reviewId, setReviewId] = useState<string | null>(null);

  return (
    <QueryClientProvider client={panelQueryClient}>
      {reviewId ? (
        <TemplateReviewPage
          embeddedId={reviewId}
          onBack={() => setReviewId(null)}
        />
      ) : (
        <AssessmentsListPage
          onNavigateToReview={(id: string) => setReviewId(id)}
        />
      )}
      <Toaster
        position="top-right"
        toastOptions={{ style: { borderRadius: "10px", fontSize: "13px" } }}
      />
    </QueryClientProvider>
  );
}
