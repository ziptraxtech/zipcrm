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
            // Shape of what the browser sent, never the values: is there a bearer token, and which cookies
            const header = req.headers.authorization || '';
            const token = header.replace(/^Bearer\s+/i, '');
            const sent = !header ? 'no Authorization header'
                : `Authorization "${header.slice(0, 7)}…" token length ${token.length}, looks like JWT: ${token.split('.').length === 3}`;
            const cookies = (req.headers.cookie || '').split(';').map((c) => c.split('=')[0].trim()).filter(Boolean).join(',') || 'none';
            console.log(`401 ${req.method} ${req.originalUrl.split('?')[0]}: ${reason || 'no token'} - ${detail || ''} | ${sent} | cookies: ${cookies}`);
            return res.status(401).json({ message: reason ? `Unauthorized (${reason})` : "Unauthorized" });
        }

        return next()
    } catch (error) {
        console.log(error);
        res.status(401).json({ message: error.code || error.message });
    }
}
