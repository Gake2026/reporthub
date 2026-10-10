import { redirect } from "next/navigation";
import { getSession } from "../../../lib/auth";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <>
      <div className="pagehead">
        <h1>My account</h1>
        <span className="sub">Profile, picture, and password</span>
      </div>

      <AccountClient />
    </>
  );
}
