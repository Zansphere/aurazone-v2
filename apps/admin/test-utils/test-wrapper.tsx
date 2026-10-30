import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithQueryClient(
  ui: React.ReactElement,
  client = createTestQueryClient()
) {
  return {
    client,
    ...require("@testing-library/react").render(
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    ),
  };
}

