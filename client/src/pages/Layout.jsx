import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { Loader2Icon } from 'lucide-react'
import {useUser, SignIn, useAuth, CreateOrganization} from '@clerk/clerk-react'
import { fetchWorkspaces } from '../features/workspaceSlice'

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [devMode, setDevMode] = useState(!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live'))
    const { loading, workspaces } = useSelector((state) => state.workspace)
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

    //initial load of workspaces
    useEffect(() => {
        if((isLoaded || devMode) && user && workspaces.length === 0){
            dispatch(fetchWorkspaces({getToken}))
        }
    }, [user, isLoaded, devMode])

    // Skip auth in dev mode
    if(!user && !devMode){
        return (
            <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                <SignIn />
            </div>
        )
    }

    if (loading) return (
        <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
            <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        </div>
    )
    if(user && workspaces.length === 0){
        return (
            <div className='min-h-screen flex justify-center items-center'>
                <CreateOrganization />
            </div>
        )
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
