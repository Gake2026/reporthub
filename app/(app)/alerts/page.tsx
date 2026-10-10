import { redirect } from "next/navigation";
import { getSession } from "../../../lib/auth";
import AlertsClient from "./AlertsClient";

export default async function AlertsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "client") redirect("/");

  return (
    <>
      <div className="pagehead">
        <h1>Alerts</h1>
        <span className="sub">
          Automatic swing flags on spend, conversions, click-through rate, and
          cost per acquisition
        </span>
      </div>
      <AlertsClient />
    </>
  );
}
