/** Pages that use the full-screen phone browsing layout (their own header, category sidebar and grid). */
export function isBrowsePath(pathname: string): boolean {
  return (
    pathname === "/shop" ||
    pathname.startsWith("/shop/") ||
    pathname === "/offers" ||
    /^\/categories\/[^/]+/.test(pathname)
  );
}
