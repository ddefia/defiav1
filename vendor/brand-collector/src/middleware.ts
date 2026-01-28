// Middleware removed - auth will be handled by your existing system
// You can add your own middleware here if needed

export function middleware(request: any) {
  // No-op middleware - add your auth logic here if needed
  return
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
