import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { Loader2Icon } from 'lucide-react'
import {useUser, SignIn, useAuth} from '@clerk/clerk-react'
import { fetchWorkspaces } from '../features/workspaceSlice'
import NoWorkspace from '../components/NoWorkspace'

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [devMode, setDevMode] = useState(!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live'))
    const { loaded, error, workspaces } = useSelector((state) => state.workspace)
    const dispatch = useDispatch()
    const {user, isLoaded} = useUser()
    const {getToken} = useAuth()

    // Initial load of theme
    useEffect(() => {
        dispatch(loadTheme())
    }, [])

    // Check if we're in dev mode (no valid Clerk key)
    useEffect(() => {
        const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
        const isDev = !clerkKey || clerkKey.includes('placeholder') || !clerkKey.startsWith('pk_')
        setDevMode(isDev)
    }, [])

    // Load workspaces whenever the signed-in person changes, so switching accounts
    // never shows the previous account's workspaces
    useEffect(() => {
        if((isLoaded || devMode) && user?.id){
            dispatch(fetchWorkspaces({getToken}))
        }
    }, [user?.id, isLoaded, devMode])

    // Skip auth in dev mode
    if(!user && !devMode){
        return (
            <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                <SignIn />
            </div>
        )
    }

    // Spinner only for the first load; later refreshes keep the current screen mounted
    if (user && !loaded) return (
        <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
            <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        </div>
    )
    if (user && error && workspaces.length === 0) return (
        <div className='flex flex-col gap-3 items-center justify-center h-screen bg-white dark:bg-zinc-950 text-gray-700 dark:text-zinc-300'>
            <p className='text-sm'>Couldn't load your workspaces: {error}</p>
            <button onClick={() => dispatch(fetchWorkspaces({getToken}))} className='px-4 py-1.5 rounded text-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90'>Retry</button>
        </div>
    )
    // Workspaces are joined by invitation only - never offer to create one here
    if(user && workspaces.length === 0){
        return <NoWorkspace />
    }
    return (
        <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col h-screen">
                <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}

export default Layout
