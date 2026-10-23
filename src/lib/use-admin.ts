import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "./store";
import { getAdminAccess } from "./admin.functions";

/** Whether the signed-in account has the admin role (checked on the server). */
export function useIsAdmin() {
  const email = useStore((s) => s.user?.email);
  const check = useServerFn(getAdminAccess);
  const q = useQuery({ queryKey: ["admin-access", email], queryFn: () => check(), enabled: !!email, staleTime: 5 * 60_000, retry: false });
  return { isAdmin: q.data?.isAdmin === true, loading: !!email && q.isLoading };
}
