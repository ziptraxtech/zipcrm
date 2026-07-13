export const protect = async (req, res, next) => {
    try {
        // Development mode - bypass auth if CLERK_SECRET_KEY is not set
        if (!process.env.CLERK_SECRET_KEY) {
            // Set a test user for development
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