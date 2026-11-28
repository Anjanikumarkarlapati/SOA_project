"use client";

import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SchemesAndLocker } from "@/components/schemes/SchemesAndLocker";

export default function SchemesPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <SchemesAndLocker />
      </AppLayout>
    </ProtectedRoute>
  );
}
