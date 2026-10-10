import { redirect } from "next/navigation";
import { getSession } from "../../../lib/auth";
import DeliveryClient from "./DeliveryClient";

export default async function DeliveryPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "client") redirect("/");

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Delivery</h1>
          <div className="sub">
            Scheduled report emails and delivery history
          </div>
        </div>
      </div>
      <DeliveryClient />
    </>
  );
}
