export const protect = async (req, res, next) => {
    try {
        if (!process.env.CLERK_SECRET_KEY) {
            // Local development only - bypass auth with a test user.
            // Anywhere else, fail closed: these routes expose customer data.
            if (process.env.NODE_ENV !== 'development') {
                return res.status(500).json({ message: "Server auth is not configured" });
            }
            req.auth = () => Promise.resolve({ userId: 'dev-user-123' });
            return next();
        }

        const { userId } = await req.auth();

        if (!userId){
            // clerkMiddleware records why it treated the request as signed out (expired, wrong instance, ...)
            const reason = res.getHeader('x-clerk-auth-reason');
            const detail = res.getHeader('x-clerk-auth-message');
            console.log(`401 ${req.method} ${req.path}: ${reason || 'no token'} - ${detail || ''}`);
            return res.status(401).json({ message: reason ? `Unauthorized (${reason})` : "Unauthorized" });
        }

        return next()
    } catch (error) {
        console.log(error);
        res.status(401).json({ message: error.code || error.message });
    }
}
