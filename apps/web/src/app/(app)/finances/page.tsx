import type { Metadata } from "next";
import { FinancesPage } from "@/features/finances/finances-page";

export const metadata: Metadata = {
  title: "Finances",
  description:
    "Your band's books: show fees, merch and expenses, how the money splits between members, and who is owed what.",
};

export default function Page() {
  return <FinancesPage />;
}
