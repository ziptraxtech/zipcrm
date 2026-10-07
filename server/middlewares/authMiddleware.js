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
            return res.status(401).json({ message: "Unauthorized" });
        }

        return next()
    } catch (error) {
        console.log(error);
        res.status(401).json({ message: error.code || error.message });
    }
}
