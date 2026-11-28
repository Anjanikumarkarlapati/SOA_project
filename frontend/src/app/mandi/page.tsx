"use client";

import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MandiBoard } from "@/components/mandi/MandiBoard";

export default function MandiPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <MandiBoard />
      </AppLayout>
    </ProtectedRoute>
  );
}
